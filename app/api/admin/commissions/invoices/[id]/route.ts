import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1) }),
  z.object({ action: z.literal("mark_paid"), paymentReference: z.string().min(1), paymentDate: z.string().min(1) }),
]);

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function parseCommissionIds(bankDetails: string | null) {
  if (!bankDetails) return [] as string[];
  try {
    const parsed = JSON.parse(bankDetails) as { commissionIds?: string[] };
    return Array.isArray(parsed.commissionIds) ? parsed.commissionIds.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  const invoice = await db.subAgentInvoice.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      currency: true,
      status: true,
      bankDetails: true,
      subAgent: {
        select: {
          userId: true,
          agencyName: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (body.action === "approve") {
    const updated = await db.subAgentInvoice.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        approvedBy: session.user.id,
        approvedAt: new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "sub_agent_invoice",
        entityId: updated.id,
        action: "APPROVED",
        details: `Invoice ${invoice.invoiceNumber} approved`,
      },
    });

    await NotificationService.createNotification({
      userId: invoice.subAgent.userId,
      type: "INVOICE_APPROVED",
      message: `Your invoice ${invoice.invoiceNumber} has been approved.`,
      linkUrl: "/agent/invoices",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    if (invoice.subAgent.user.email) {
      await sendResendEmail({
        to: invoice.subAgent.user.email,
        subject: "Your invoice has been approved",
        html: `<p>Your invoice <strong>${invoice.invoiceNumber}</strong> has been approved.</p>`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "reject") {
    const updated = await db.subAgentInvoice.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        adminNote: body.reason,
        approvedBy: session.user.id,
      },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "sub_agent_invoice",
        entityId: updated.id,
        action: "REJECTED",
        details: `Invoice ${invoice.invoiceNumber} rejected. Reason: ${body.reason}`,
      },
    });

    await NotificationService.createNotification({
      userId: invoice.subAgent.userId,
      type: "INVOICE_REJECTED",
      message: `Your invoice ${invoice.invoiceNumber} was rejected.`,
      linkUrl: "/agent/invoices",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    if (invoice.subAgent.user.email) {
      await sendResendEmail({
        to: invoice.subAgent.user.email,
        subject: "Your invoice has been rejected",
        html: `<p>Your invoice <strong>${invoice.invoiceNumber}</strong> has been rejected.</p><p>Reason: ${body.reason}</p>`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "mark_paid") {
    const paidAt = new Date(body.paymentDate);
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const invoiceUpdate = await tx.subAgentInvoice.update({
        where: { id: params.id },
        data: {
          status: "PAID",
          paidAt,
          paymentRef: body.paymentReference,
          approvedBy: session.user.id,
        },
      });

      const commissionIds = parseCommissionIds(invoice.bankDetails);
      if (commissionIds.length > 0) {
        await tx.commission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: "PAID" },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "sub_agent_invoice",
          entityId: invoiceUpdate.id,
          action: "PAID",
          details: `Invoice ${invoice.invoiceNumber} marked paid. Reference: ${body.paymentReference}`,
        },
      });

      return invoiceUpdate;
    });

    if (invoice.subAgent.user.email) {
      await sendResendEmail({
        to: invoice.subAgent.user.email,
        subject: `Payment of ${invoice.currency} ${invoice.totalAmount.toFixed(2)} has been processed`,
        html: `<p>Payment of <strong>${invoice.currency} ${invoice.totalAmount.toFixed(2)}</strong> has been processed for invoice <strong>${invoice.invoiceNumber}</strong>.</p><p>Reference: ${body.paymentReference}</p>`,
      }).catch(() => undefined);
    }

    await NotificationService.createNotification({
      userId: invoice.subAgent.userId,
      type: "INVOICE_PAID",
      message: `Payment received for invoice ${invoice.invoiceNumber}.`,
      linkUrl: "/agent/invoices",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, data: updated });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
