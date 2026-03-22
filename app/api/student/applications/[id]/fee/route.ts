import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getApplicationFeeSummary, markPaymentPendingApproval } from "@/lib/application-fees";
import { NotificationService } from "@/lib/notifications";

const updateSchema = z.object({
  paymentRef: z.string().optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    include: {
      student: {
        select: {
          id: true,
          userId: true,
          assignedCounsellorId: true,
        },
      },
      course: {
        select: {
          id: true,
          name: true,
        },
      },
      university: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!application || application.student.userId !== session.user.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const fee = await getApplicationFeeSummary(application.id);

  return NextResponse.json({
    data: {
      application: {
        id: application.id,
        studentId: application.studentId,
        status: application.status,
        isUcas: application.isUcas,
      },
      university: application.university,
      course: application.course,
      fee,
      bankDetails: {
        accountName: process.env.BANK_ACCOUNT_NAME || "EduQuantica Ltd",
        bankName: process.env.BANK_NAME || "HSBC UK",
        sortCode: process.env.BANK_SORT_CODE || "00-00-00",
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || "00000000",
        iban: process.env.BANK_IBAN || "GB00 BANK 0000 0000 0000 00",
        swift: process.env.BANK_SWIFT || "HBUKGB4B",
      },
      paymentReferenceSuggestion: `${application.studentId}-${application.id}`,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    include: {
      student: {
        select: {
          id: true,
          userId: true,
          assignedCounsellorId: true,
          subAgent: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!application || application.student.userId !== session.user.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const fee = await getApplicationFeeSummary(application.id);
  if (!fee.feeRequired || !fee.targetPaymentId) {
    return NextResponse.json({ error: "No payable fee found for this application" }, { status: 400 });
  }

  await markPaymentPendingApproval({
    paymentId: fee.targetPaymentId,
    paymentRef: parsed.data.paymentRef || null,
    receiptUrl: parsed.data.receiptUrl || null,
    paymentMethod: parsed.data.paymentMethod || "BANK_TRANSFER",
    paidBy: session.user.id,
    paidByRole: "STUDENT",
  });

  if (application.student.assignedCounsellorId) {
    await NotificationService.createNotification({
      userId: application.student.assignedCounsellorId,
      type: "FINANCE_FEE_PENDING_APPROVAL",
      message: "A student uploaded an application fee receipt pending approval.",
      linkUrl: `/dashboard/applications/${application.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  if (application.student.subAgent?.userId) {
    await NotificationService.createNotification({
      userId: application.student.subAgent.userId,
      type: "FINANCE_FEE_PENDING_APPROVAL",
      message: "A student uploaded an application fee receipt pending approval.",
      linkUrl: `/agent/students/${application.studentId}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  const refreshed = await getApplicationFeeSummary(application.id);
  return NextResponse.json({ data: { fee: refreshed } });
}
