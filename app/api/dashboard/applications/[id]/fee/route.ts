import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { FeePaymentStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getApplicationFeeSummary,
  markPaymentAsPaid,
  markPaymentPendingApproval,
} from "@/lib/application-fees";
import { NotificationService } from "@/lib/notifications";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT"]);

const payloadSchema = z.object({
  action: z.enum(["payOnBehalf", "approvePayment", "approveWaiver", "inviteStudent"]),
  paymentMethod: z.enum(["CASH_RECEIVED", "BANK_TRANSFER", "WAIVED"]).optional(),
  paymentRef: z.string().optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

async function loadApplication(id: string) {
  return db.application.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          subAgent: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });
}

function canAccess(roleName: string, userId: string, application: Awaited<ReturnType<typeof loadApplication>>) {
  if (!application) return false;
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;
  if (roleName === "COUNSELLOR") return application.student.assignedCounsellorId === userId;
  if (roleName === "SUB_AGENT") return application.student.subAgent?.userId === userId;
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await loadApplication(params.id);
  if (!canAccess(session.user.roleName, session.user.id, application)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const fee = await getApplicationFeeSummary(params.id);
  return NextResponse.json({ data: { fee } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const application = await loadApplication(params.id);
  if (!canAccess(session.user.roleName, session.user.id, application)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const payload = parsed.data;

  const fee = await getApplicationFeeSummary(params.id);
  if (!fee.feeRequired) {
    return NextResponse.json({ error: "No payable fee found for this application" }, { status: 400 });
  }

  if (payload.action === "inviteStudent") {
    await NotificationService.createNotification({
      userId: application.student.userId,
      type: "FINANCE_FEE_PENDING_APPROVAL",
      message: "Please complete your application fee payment to continue processing.",
      linkUrl: `/student/applications/${application.id}/fee`,
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ data: { fee } });
  }

  if (!fee.targetPaymentId) {
    return NextResponse.json({ error: "No payable fee found for this application" }, { status: 400 });
  }

  if (payload.action === "payOnBehalf") {
    if (!payload.paymentMethod) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    if (payload.paymentMethod === "WAIVED") {
      await markPaymentPendingApproval({
        paymentId: fee.targetPaymentId,
        paymentRef: payload.paymentRef || null,
        receiptUrl: payload.receiptUrl || null,
        paymentMethod: "WAIVED_REQUEST",
        paidBy: session.user.id,
        paidByRole: session.user.roleName,
      });

      const managers = await db.user.findMany({
        where: {
          role: { name: { in: ["ADMIN", "MANAGER"] } },
          isActive: true,
        },
        select: { id: true },
      });

      await Promise.all(
        managers.map((manager) =>
          NotificationService.createNotification({
            userId: manager.id,
            type: "FINANCE_FEE_WAIVER_APPROVAL_REQUESTED",
            message: "Application fee waiver request requires approval.",
            linkUrl: `/dashboard/applications/${application.id}`,
            actorUserId: session.user.id,
          }).catch(() => undefined),
        ),
      );
    } else {
      await markPaymentAsPaid({
        paymentId: fee.targetPaymentId,
        paymentRef: payload.paymentRef || null,
        receiptUrl: payload.receiptUrl || null,
        paymentMethod: payload.paymentMethod,
        paidBy: session.user.id,
        paidByRole: session.user.roleName,
      });

      await NotificationService.createNotification({
        userId: application.student.userId,
        type: "FINANCE_FEE_PAID_ON_BEHALF",
        message: "Your application fee has been paid by your counsellor/agent.",
        linkUrl: `/student/applications/${application.id}`,
        actorUserId: session.user.id,
      }).catch(() => undefined);

      const managers = await db.user.findMany({
        where: {
          role: { name: { in: ["ADMIN", "MANAGER"] } },
          isActive: true,
        },
        select: { id: true },
      });

      await Promise.all(
        managers.map((manager) =>
          NotificationService.createNotification({
            userId: manager.id,
            type: "FINANCE_FEE_PAID_ON_BEHALF",
            message: "An application fee was paid on behalf of a student.",
            linkUrl: `/dashboard/applications/${application.id}`,
            actorUserId: session.user.id,
          }).catch(() => undefined),
        ),
      );
    }
  }

  if (payload.action === "approvePayment") {
    await db.applicationFeePayment.update({
      where: { id: fee.targetPaymentId },
      data: {
        status: FeePaymentStatus.PAID,
      },
    });
  }

  if (payload.action === "approveWaiver") {
    if (!(session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER")) {
      return NextResponse.json({ error: "Only managers can approve waiver requests" }, { status: 403 });
    }

    await db.applicationFeePayment.update({
      where: { id: fee.targetPaymentId },
      data: {
        status: FeePaymentStatus.WAIVED,
      },
    });

    await NotificationService.createNotification({
      userId: application.student.userId,
      type: "FINANCE_FEE_WAIVED",
      message: "Your application fee waiver has been approved.",
      linkUrl: `/student/applications/${application.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  const refreshed = await getApplicationFeeSummary(params.id);
  return NextResponse.json({ data: { fee: refreshed } });
}
