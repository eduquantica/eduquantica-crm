import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { readLatestAction } from "@/lib/application-finance";
import { scanFinancialDoc } from "@/lib/mindee";
import { parseDurationMonths, resolveFinancialRequirement, resolveVisaLivingExpenseMonths } from "@/lib/financial-requirements";
import { maskAccountNumber, verifyBankStatement } from "@/lib/bank-statement-verification";
import { NotificationService } from "@/lib/notifications";

const schema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  accountRef: z.object({
    accountOwner: z.enum(["MY_OWN", "SOMEONE_ELSE", "JOINT"]),
    country: z.string().min(2),
    bankName: z.string().min(2),
    accountCurrency: z.string().min(3).max(3),
  }),
});

function canUpload(role?: string) {
  return role === "ADMIN"
    || role === "MANAGER"
    || role === "COUNSELLOR"
    || role === "SUB_AGENT"
    || role === "STUDENT"
    || role === "BRANCH_MANAGER"
    || role === "SUB_AGENT_COUNSELLOR";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canUpload(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            assignedCounsellorId: true,
            subAgent: { select: { userId: true } },
          },
        },
        course: {
          select: {
            tuitionFee: true,
            duration: true,
          },
        },
        university: {
          select: {
            country: true,
          },
        },
        scholarshipApps: {
          where: {
            OR: [{ applicationId: params.id }, { applicationId: null }],
          },
          include: {
            scholarship: {
              select: { amount: true },
            },
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (session.user.roleName === "COUNSELLOR" && application.student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "SUB_AGENT" && application.student.subAgent?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "STUDENT" && application.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const offerUpload = await readLatestAction<{
      ocr: { scholarship: number | null };
    }>(params.id, "offer_letter_uploaded");

    const depositApprovalLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "deposit_receipt_approved",
      },
      select: { details: true },
    });

    const depositPaid = depositApprovalLogs.reduce((sum, row) => {
      if (!row.details) return sum;
      try {
        const parsedDetails = JSON.parse(row.details) as { amountPaid: number | null };
        return sum + (parsedDetails.amountPaid || 0);
      } catch {
        return sum;
      }
    }, 0);

    const scholarshipFromSystem = application.scholarshipApps
      .filter((item) => item.status !== "REJECTED")
      .reduce((max, item) => {
        const value = item.awardedAmount ?? item.scholarship.amount ?? 0;
        return value > max ? value : max;
      }, 0);

    const scholarshipFinal = Math.max(scholarshipFromSystem, offerUpload?.ocr?.scholarship || 0);
    const courseFee = application.course.tuitionFee || 0;
    const remainingTuition = Math.max(courseFee - scholarshipFinal - depositPaid, 0);

    const activeRule = resolveFinancialRequirement(application.university.country);
    const courseDurationMonths = Math.max(parseDurationMonths(application.course.duration), 1);
    const durationMonths = resolveVisaLivingExpenseMonths(application.university.country, courseDurationMonths);
    const livingExpenses = activeRule.monthlyLivingCost * durationMonths;
    const totalToShowInBank = remainingTuition + livingExpenses;

    const document = await db.document.create({
      data: {
        studentId: application.studentId,
        applicationId: application.id,
        type: "FINANCIAL_PROOF",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    const ocrResult = await scanFinancialDoc(parsed.data.fileUrl);
    const extracted = "error" in ocrResult
      ? {
          accountHolderName: "",
          bankName: parsed.data.accountRef.bankName,
          accountNumberMasked: "****",
          statementDate: null,
          closingBalance: null,
          openingBalance: null,
          currency: parsed.data.accountRef.accountCurrency,
          transactions: [] as Array<{ date: string; description: string; amount: number }>,
        }
      : {
          accountHolderName: ocrResult.accountHolderName || "",
          bankName: ocrResult.bankName || parsed.data.accountRef.bankName,
          accountNumberMasked: maskAccountNumber(ocrResult.accountNumber),
          statementDate: ocrResult.statementDate || null,
          closingBalance: Number.isFinite(ocrResult.closingBalance) ? ocrResult.closingBalance : null,
          openingBalance: ocrResult.openingBalance,
          currency: ocrResult.currency || parsed.data.accountRef.accountCurrency,
          transactions: (ocrResult.transactions || []).map((item) => ({
            date: item.date || "",
            description: item.description || "",
            amount: Number(item.amount || 0),
          })),
        };

    const verification = verifyBankStatement({
      extracted,
      studentFullName: `${application.student.firstName} ${application.student.lastName}`.trim(),
      destinationCountry: application.university.country,
      submittedAt: application.submittedAt,
      createdAt: application.createdAt,
      totalToShowInBank,
      durationMonths,
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "bank_statement_uploaded",
        details: JSON.stringify({
          documentId: document.id,
          fileName: parsed.data.fileName,
          fileUrl: parsed.data.fileUrl,
          uploadedAt: new Date().toISOString(),
          accountRef: parsed.data.accountRef,
          extracted,
          checks: verification.checks,
          outcome: verification.outcome,
          message: verification.message,
        }),
      },
    });

    if (verification.outcome !== "GREEN") {
      const studentName = `${application.student.firstName} ${application.student.lastName}`.trim();
      const message =
        verification.outcome === "RED"
          ? `Bank statement verification failed for ${studentName}.`
          : `Bank statement verification needs review for ${studentName}.`;

      if (application.student.assignedCounsellorId) {
        await NotificationService.createNotification({
          userId: application.student.assignedCounsellorId,
          type: "DOCUMENT_BANK_STATEMENT_REVIEW",
          message,
          linkUrl: `/dashboard/applications/${application.id}`,
          actorUserId: session.user.id,
        }).catch(() => undefined);
      }

      await NotificationService.createNotification({
        userId: application.student.userId,
        type: "DOCUMENT_BANK_STATEMENT_REVIEW",
        message: verification.message,
        linkUrl: `/student/applications/${application.id}`,
        actorUserId: session.user.id,
      }).catch(() => undefined);

      if (application.student.subAgent?.userId) {
        await NotificationService.createNotification({
          userId: application.student.subAgent.userId,
          type: "DOCUMENT_BANK_STATEMENT_REVIEW",
          message,
          linkUrl: `/agent/students/${application.studentId}`,
          actorUserId: session.user.id,
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({
      data: {
        documentId: document.id,
        outcome: verification.outcome,
        message: verification.message,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/bank-statement POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
