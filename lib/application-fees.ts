import { FeeConfigType, FeePaymentStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ApplicationFeeDisplayStatus = "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";

export type ApplicationFeeSummary = {
  feeRequired: boolean;
  displayStatus: ApplicationFeeDisplayStatus;
  amount: number;
  currency: string;
  feeType: FeeConfigType | null;
  coveredByExisting: boolean;
  applicationPaymentId: string | null;
  targetPaymentId: string | null;
  groupMessage: string | null;
};

function isCurrentConfig(config: { effectiveFrom: Date; effectiveTo: Date | null }, now: Date) {
  return config.effectiveFrom <= now && (!config.effectiveTo || config.effectiveTo >= now);
}

export function getAcademicYearLabel(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export async function getActiveFeeConfig(args: {
  configType: FeeConfigType;
  universityId?: string | null;
  now?: Date;
}) {
  const now = args.now || new Date();

  const rows = await db.applicationFeeConfig.findMany({
    where: {
      configType: args.configType,
      universityId: args.universityId ?? null,
    },
    orderBy: [
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
    take: 25,
  });

  return rows.find((row) => isCurrentConfig(row, now)) || rows[0] || null;
}

async function ensureUcasFeePayment(applicationId: string) {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      course: {
        select: {
          currency: true,
        },
      },
    },
  });

  if (!application || !application.isUcas) return;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startYear = month >= 7 ? year : year - 1;
  const academicYearStart = new Date(Date.UTC(startYear, 7, 1, 0, 0, 0));
  const academicYearEnd = new Date(Date.UTC(startYear + 1, 7, 1, 0, 0, 0));

  const studentUcasApplications = await db.application.findMany({
    where: {
      studentId: application.studentId,
      isUcas: true,
      createdAt: {
        gte: academicYearStart,
        lt: academicYearEnd,
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ucasGroupId: true,
    },
  });

  const thisIndex = studentUcasApplications.findIndex((row) => row.id === application.id);
  if (thisIndex < 0) return;

  const ucasCount = thisIndex + 1;
  const existingGroupId = studentUcasApplications.find((row) => !!row.ucasGroupId)?.ucasGroupId || null;
  const groupId = existingGroupId || `UCAS-${application.studentId.slice(0, 8)}-${Date.now()}`;

  if (!application.ucasGroupId) {
    await db.application.update({
      where: { id: application.id },
      data: { ucasGroupId: groupId },
    });
  }

  if (ucasCount >= 2 && ucasCount <= 5) {
    return;
  }

  const configType = ucasCount === 1 ? FeeConfigType.UCAS_SINGLE : FeeConfigType.UCAS_MULTIPLE;
  const config = await getActiveFeeConfig({ configType });
  if (!config) return;

  await db.applicationFeePayment.create({
    data: {
      applicationId: application.id,
      studentId: application.studentId,
      universityId: application.universityId,
      ucasGroupId: groupId,
      feeType: configType,
      amount: config.amount,
      currency: config.currency || application.course.currency || "GBP",
      status: FeePaymentStatus.PENDING,
    },
  });
}

async function ensureDirectFeePayment(applicationId: string) {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      course: {
        select: {
          applicationFee: true,
          currency: true,
        },
      },
      university: {
        select: {
          applicationFee: true,
          currency: true,
        },
      },
    },
  });

  if (!application || application.isUcas) return;

  const amount = application.course.applicationFee ?? application.university.applicationFee ?? 0;
  if (amount <= 0) return;

  const existing = await db.applicationFeePayment.findFirst({
    where: { applicationId: application.id },
    select: { id: true },
  });
  if (existing) return;

  await db.applicationFeePayment.create({
    data: {
      applicationId: application.id,
      studentId: application.studentId,
      universityId: application.universityId,
      feeType: FeeConfigType.UNIVERSITY_DIRECT,
      amount,
      currency: application.course.currency || application.university.currency || "GBP",
      status: FeePaymentStatus.PENDING,
    },
  });
}

export async function ensureFeePaymentForApplication(applicationId: string) {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { isUcas: true },
  });

  if (!application) return;
  if (application.isUcas) {
    await ensureUcasFeePayment(applicationId);
    return;
  }
  await ensureDirectFeePayment(applicationId);
}

function mapDisplayStatus(payment: {
  status: FeePaymentStatus;
  receiptUrl: string | null;
} | null, feeRequired: boolean): ApplicationFeeDisplayStatus {
  if (!feeRequired) return "NOT_REQUIRED";
  if (!payment) return "UNPAID";
  if (payment.status === FeePaymentStatus.PAID) return "PAID";
  if (payment.status === FeePaymentStatus.WAIVED) return "WAIVED";
  if (payment.status === FeePaymentStatus.PENDING && payment.receiptUrl) return "PENDING_APPROVAL";
  return "UNPAID";
}

export async function getApplicationFeeSummary(applicationId: string): Promise<ApplicationFeeSummary> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      course: {
        select: {
          applicationFee: true,
          currency: true,
        },
      },
      university: {
        select: {
          applicationFee: true,
          currency: true,
        },
      },
      feePayments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application) {
    return {
      feeRequired: false,
      displayStatus: "NOT_REQUIRED",
      amount: 0,
      currency: "GBP",
      feeType: null,
      coveredByExisting: false,
      applicationPaymentId: null,
      targetPaymentId: null,
      groupMessage: null,
    };
  }

  if (application.isUcas) {
    const ucasGroupId = application.ucasGroupId;
    const groupPayments = ucasGroupId
      ? await db.applicationFeePayment.findMany({
        where: {
          studentId: application.studentId,
          ucasGroupId,
          feeType: { in: [FeeConfigType.UCAS_SINGLE, FeeConfigType.UCAS_MULTIPLE] },
        },
        orderBy: { createdAt: "desc" },
      })
      : [];

    const appPayment = application.feePayments[0] || null;
    const targetPayment = appPayment || groupPayments[0] || null;

    const fallbackConfig = await getActiveFeeConfig({ configType: FeeConfigType.UCAS_SINGLE });
    const amount = targetPayment?.amount ?? fallbackConfig?.amount ?? 0;
    const currency = targetPayment?.currency ?? fallbackConfig?.currency ?? application.course.currency ?? "GBP";
    const coveredByExisting = !appPayment && !!targetPayment;

    return {
      feeRequired: true,
      displayStatus: mapDisplayStatus(targetPayment, true),
      amount,
      currency,
      feeType: targetPayment?.feeType || FeeConfigType.UCAS_SINGLE,
      coveredByExisting,
      applicationPaymentId: appPayment?.id || null,
      targetPaymentId: targetPayment?.id || null,
      groupMessage: coveredByExisting ? "Covered by existing UCAS payment" : "This fee covers up to 5 UCAS applications",
    };
  }

  const amount = application.course.applicationFee ?? application.university.applicationFee ?? 0;
  const feeRequired = amount > 0;
  const payment = application.feePayments[0] || null;
  const currency = payment?.currency || application.course.currency || application.university.currency || "GBP";

  return {
    feeRequired,
    displayStatus: mapDisplayStatus(payment, feeRequired),
    amount,
    currency,
    feeType: feeRequired ? FeeConfigType.UNIVERSITY_DIRECT : null,
    coveredByExisting: false,
    applicationPaymentId: payment?.id || null,
    targetPaymentId: payment?.id || null,
    groupMessage: null,
  };
}

export async function isApplicationFeeCleared(applicationId: string): Promise<boolean> {
  const summary = await getApplicationFeeSummary(applicationId);
  return summary.displayStatus === "PAID" || summary.displayStatus === "WAIVED" || summary.displayStatus === "NOT_REQUIRED";
}

export async function markPaymentAsPaid(args: {
  paymentId: string;
  paymentRef?: string | null;
  receiptUrl?: string | null;
  paymentMethod?: string | null;
  paidBy?: string | null;
  paidByRole?: string | null;
}) {
  return db.applicationFeePayment.update({
    where: { id: args.paymentId },
    data: {
      status: FeePaymentStatus.PAID,
      paymentRef: args.paymentRef ?? null,
      receiptUrl: args.receiptUrl ?? null,
      paymentMethod: args.paymentMethod ?? null,
      paidBy: args.paidBy ?? null,
      paidByRole: args.paidByRole ?? null,
      paidAt: new Date(),
    },
  });
}

export async function markPaymentPendingApproval(args: {
  paymentId: string;
  paymentRef?: string | null;
  receiptUrl?: string | null;
  paymentMethod?: string | null;
  paidBy?: string | null;
  paidByRole?: string | null;
}) {
  return db.applicationFeePayment.update({
    where: { id: args.paymentId },
    data: {
      status: FeePaymentStatus.PENDING,
      paymentRef: args.paymentRef ?? null,
      receiptUrl: args.receiptUrl ?? null,
      paymentMethod: args.paymentMethod ?? null,
      paidBy: args.paidBy ?? null,
      paidByRole: args.paidByRole ?? null,
      paidAt: new Date(),
    },
  });
}

export async function upsertApplicationPayment(args: {
  applicationId: string;
  studentId: string;
  universityId: string;
  amount: number;
  currency: string;
  feeType: FeeConfigType;
  ucasGroupId?: string | null;
  data: Prisma.ApplicationFeePaymentUpdateInput;
  createData: Prisma.ApplicationFeePaymentCreateInput;
}) {
  const existing = await db.applicationFeePayment.findFirst({
    where: { applicationId: args.applicationId },
    select: { id: true },
  });

  if (existing) {
    return db.applicationFeePayment.update({
      where: { id: existing.id },
      data: args.data,
    });
  }

  return db.applicationFeePayment.create({ data: args.createData });
}
