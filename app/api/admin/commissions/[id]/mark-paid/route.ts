import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { calculateSubAgentTier } from "@/lib/subagent-tier";

const schema = z.object({
  paymentReference: z.string().min(1),
  paymentDate: z.string().min(1),
});

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
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const paymentAt = new Date(parsed.data.paymentDate);
  if (Number.isNaN(paymentAt.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  const commission = await db.commission.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      agentAmount: true,
      subAgentId: true,
      applicationId: true,
    },
  });

  if (!commission) {
    return NextResponse.json({ error: "Commission not found" }, { status: 404 });
  }

  if (commission.status !== "INVOICED") {
    return NextResponse.json({ error: "Only invoiced commissions can be marked as paid" }, { status: 400 });
  }

  const approvedInvoices = commission.subAgentId
    ? await db.subAgentInvoice.findMany({
        where: {
          subAgentId: commission.subAgentId,
          status: "APPROVED",
        },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          bankDetails: true,
        },
      })
    : [];

  const approvedInvoiceWithCommission = approvedInvoices.find((invoice) =>
    parseCommissionIds(invoice.bankDetails).includes(commission.id),
  );

  if (approvedInvoices.length > 0 && !approvedInvoiceWithCommission) {
    return NextResponse.json({ error: "Commission is not in an approved invoice" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.commission.update({
      where: { id: commission.id },
      data: {
        status: "PAID",
        notes: `Payment Ref: ${parsed.data.paymentReference} | Paid At: ${paymentAt.toISOString()}`,
      },
    });

    if (approvedInvoiceWithCommission) {
      const idsInInvoice = parseCommissionIds(approvedInvoiceWithCommission.bankDetails);
      const paidCount = await tx.commission.count({
        where: {
          id: { in: idsInInvoice },
          status: "PAID",
        },
      });
      const allPaid = idsInInvoice.length > 0 && paidCount === idsInInvoice.length;
      if (allPaid) {
        await tx.subAgentInvoice.update({
          where: { id: approvedInvoiceWithCommission.id },
          data: {
            status: "PAID",
            paidAt: paymentAt,
            paymentRef: parsed.data.paymentReference,
            approvedBy: session.user.id,
          },
        });
      }
    }

    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "commission",
        entityId: commission.id,
        action: "MARKED_PAID",
        details: `Marked commission paid. Reference: ${parsed.data.paymentReference}`,
      },
    });
  });

  if (commission.subAgentId) {
    await calculateSubAgentTier(commission.subAgentId).catch((error) => {
      console.error("Failed to recalculate sub-agent tier after payment", error);
    });
  }

  return NextResponse.json({ ok: true });
}
