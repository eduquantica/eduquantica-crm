import { db } from "@/lib/db";
import ReportsClient, {
  type AcademicMatchDistributionRow,
  type ApplicationPipelineCountRow,
  type ApplicationStageConversionRow,
  type ApplicationStageDurationRow,
  type InterviewBreakdownRow,
  type InterviewListRow,
  type InterviewSummary,
  type MockInterviewDetailRow,
  type MockInterviewMonthlyRow,
  type EduviChatSummary,
  type EduviCommonQuestionRow,
  type EduviLanguageUsageRow,
  type EduviChatSessionRow,
  type AvgMatchScoreNationalityRow,
  type CommonMissingSubjectRow,
  type CommissionCountryRow,
  type CommissionMonthlyTrendRow,
  type CommissionRevenueSummary,
  type ApplicationFeeSummary,
  type ApplicationFeePaymentRow,
  type ScholarshipMonthlyTrendRow,
  type ScholarshipStatusCountRow,
  type ScholarshipSummary,
  type TopScholarshipUniversityRow,
  type TopSubAgentRow,
  type TopUniversityCommissionRow,
  type CountryApprovalRow,
  type UpcomingAppointmentRow,
  type VisaStatusCountRow,
} from "./ReportsClient";

export const dynamic = "force-dynamic";

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

const APPLICATION_STAGES = [
  "APPLIED",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_SUBMITTED",
  "SUBMITTED_TO_UNIVERSITY",
  "CONDITIONAL_OFFER",
  "UNCONDITIONAL_OFFER",
  "FINANCE_IN_PROGRESS",
  "DEPOSIT_PAID",
  "FINANCE_COMPLETE",
  "CAS_ISSUED",
  "VISA_APPLIED",
  "ENROLLED",
  "WITHDRAWN",
] as const;

const STAGE_LABELS: Record<string, string> = {
  APPLIED: "Application Submitted",
  DOCUMENTS_PENDING: "Documents Requested",
  DOCUMENTS_SUBMITTED: "Documents Verified",
  SUBMITTED_TO_UNIVERSITY: "Submitted to University",
  CONDITIONAL_OFFER: "Offer Received",
  UNCONDITIONAL_OFFER: "Unconditional Offer",
  FINANCE_IN_PROGRESS: "Finance Started",
  DEPOSIT_PAID: "Deposit Confirmed",
  FINANCE_COMPLETE: "Finance Complete",
  CAS_ISSUED: "CAS Issued",
  VISA_APPLIED: "Visa Applied",
  ENROLLED: "Enrolled",
  WITHDRAWN: "Withdrawn",
};

export default async function ReportsPage() {
  const prismaWithInterview = db as typeof db & {
    preCasInterview: {
      findMany: (...args: unknown[]) => Promise<PreCasInterviewRow[]>;
    };
    visaInterview: {
      findMany: (...args: unknown[]) => Promise<VisaInterviewRow[]>;
    };
  };

  const visaStatusCountsRaw = await db.visaApplication.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const visaStatusCounts: VisaStatusCountRow[] = visaStatusCountsRaw.map((row) => ({
    status: row.status,
    count: row._count._all,
  }));

  const countryStatusRows = await db.visaApplication.groupBy({
    by: ["country", "status"],
    _count: { _all: true },
  });

  const countryMap = new Map<string, CountryApprovalRow>();

  for (const row of countryStatusRows) {
    const existing = countryMap.get(row.country) || {
      country: row.country,
      totalApplied: 0,
      approved: 0,
      rejected: 0,
      approvalRate: 0,
    };

    existing.totalApplied += row._count._all;
    if (row.status === "APPROVED") {
      existing.approved += row._count._all;
    }
    if (row.status === "REJECTED") {
      existing.rejected += row._count._all;
    }

    countryMap.set(row.country, existing);
  }

  const countryApprovalRows = Array.from(countryMap.values())
    .map((row) => ({
      ...row,
      approvalRate: row.totalApplied > 0 ? roundToTwo((row.approved / row.totalApplied) * 100) : 0,
    }))
    .sort((a, b) => b.totalApplied - a.totalApplied);

  const allVisaIds = await db.visaApplication.findMany({
    select: { id: true },
  });

  let averageDaysToDecision = 0;

  if (allVisaIds.length > 0) {
    const logs = await db.activityLog.findMany({
      where: {
        entityType: "visa",
        entityId: { in: allVisaIds.map((v) => v.id) },
        action: {
          in: [
            "status_changed_to_SUBMITTED",
            "status_changed_to_APPROVED",
            "status_changed_to_REJECTED",
          ],
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        entityId: true,
        action: true,
        createdAt: true,
      },
    });

    const submittedByVisa = new Map<string, Date>();
    const decidedByVisa = new Map<string, Date>();

    for (const log of logs) {
      if (log.action === "status_changed_to_SUBMITTED" && !submittedByVisa.has(log.entityId)) {
        submittedByVisa.set(log.entityId, log.createdAt);
      }

      if (
        (log.action === "status_changed_to_APPROVED" || log.action === "status_changed_to_REJECTED") &&
        !decidedByVisa.has(log.entityId)
      ) {
        decidedByVisa.set(log.entityId, log.createdAt);
      }
    }

    let totalDays = 0;
    let count = 0;

    for (const [visaId, submittedAt] of Array.from(submittedByVisa.entries())) {
      const decidedAt = decidedByVisa.get(visaId);
      if (!decidedAt) continue;

      const days = (decidedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        totalDays += days;
        count += 1;
      }
    }

    averageDaysToDecision = count > 0 ? roundToTwo(totalDays / count) : 0;
  }

  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingAppointmentsRaw = await db.visaApplication.findMany({
    where: {
      appointmentDate: {
        gte: now,
        lte: inThirtyDays,
      },
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      appointmentDate: "asc",
    },
  });

  const upcomingAppointments: UpcomingAppointmentRow[] = upcomingAppointmentsRaw.map((visa) => ({
    id: visa.id,
    studentName: `${visa.student.firstName} ${visa.student.lastName}`,
    date: visa.appointmentDate?.toISOString() || "",
    location: visa.appointmentLocation || "Location not set",
  }));

  const nowUtc = new Date();
  const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0));
  const yearStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  const [summaryAllTime, summaryThisYear, summaryThisMonth, commissionRows] = await Promise.all([
    db.commission.aggregate({
      _sum: {
        grossCommission: true,
        agentAmount: true,
        eduquanticaNet: true,
      },
    }),
    db.commission.aggregate({
      where: { createdAt: { gte: yearStart } },
      _sum: {
        grossCommission: true,
        agentAmount: true,
        eduquanticaNet: true,
      },
    }),
    db.commission.aggregate({
      where: { createdAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: {
        grossCommission: true,
        agentAmount: true,
        eduquanticaNet: true,
      },
    }),
    db.commission.findMany({
      select: {
        grossCommission: true,
        agentAmount: true,
        eduquanticaNet: true,
        status: true,
        enrolmentConfirmedAt: true,
        createdAt: true,
        subAgentId: true,
        subAgent: {
          select: {
            agencyName: true,
            agreement: {
              select: {
                currentTier: true,
              },
            },
          },
        },
        application: {
          select: {
            studentId: true,
            course: {
              select: {
                university: {
                  select: {
                    name: true,
                    country: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const revenueSummary: CommissionRevenueSummary = {
    thisMonth: {
      gross: summaryThisMonth._sum.grossCommission || 0,
      agentPayouts: summaryThisMonth._sum.agentAmount || 0,
      eduquanticaNet: summaryThisMonth._sum.eduquanticaNet || 0,
    },
    thisYear: {
      gross: summaryThisYear._sum.grossCommission || 0,
      agentPayouts: summaryThisYear._sum.agentAmount || 0,
      eduquanticaNet: summaryThisYear._sum.eduquanticaNet || 0,
    },
    allTime: {
      gross: summaryAllTime._sum.grossCommission || 0,
      agentPayouts: summaryAllTime._sum.agentAmount || 0,
      eduquanticaNet: summaryAllTime._sum.eduquanticaNet || 0,
    },
  };

  const subAgentAccumulator = new Map<
    string,
    {
      agencyName: string;
      tier: string;
      earned: number;
      paid: number;
      studentIds: Set<string>;
    }
  >();
  const universityAccumulator = new Map<string, number>();
  const countryAccumulator = new Map<string, number>();

  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - i, 1, 0, 0, 0, 0));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const monthlyMap = new Map<string, { gross: number; net: number }>();
  for (const key of monthKeys) {
    monthlyMap.set(key, { gross: 0, net: 0 });
  }

  for (const row of commissionRows) {
    const gross = row.grossCommission || 0;
    const agent = row.agentAmount || 0;
    const net = row.eduquanticaNet || 0;

    const universityName = row.application.course.university.name;
    const country = row.application.course.university.country || "Unknown";
    universityAccumulator.set(universityName, (universityAccumulator.get(universityName) || 0) + gross);
    countryAccumulator.set(country, (countryAccumulator.get(country) || 0) + gross);

    const key = `${row.createdAt.getUTCFullYear()}-${String(row.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthBucket = monthlyMap.get(key);
    if (monthBucket) {
      monthBucket.gross += gross;
      monthBucket.net += net;
    }

    if (row.subAgentId && row.subAgent) {
      const existing = subAgentAccumulator.get(row.subAgentId) || {
        agencyName: row.subAgent.agencyName,
        tier: row.subAgent.agreement?.currentTier || "STANDARD",
        earned: 0,
        paid: 0,
        studentIds: new Set<string>(),
      };

      existing.earned += agent;
      if (row.status === "PAID") {
        existing.paid += agent;
      }
      if (row.enrolmentConfirmedAt) {
        existing.studentIds.add(row.application.studentId);
      }
      subAgentAccumulator.set(row.subAgentId, existing);
    }
  }

  const topSubAgents: TopSubAgentRow[] = Array.from(subAgentAccumulator.values())
    .map((row) => ({
      agencyName: row.agencyName,
      tier: row.tier,
      studentsEnrolled: row.studentIds.size,
      totalEarned: roundToTwo(row.earned),
      totalPaid: roundToTwo(row.paid),
      outstanding: roundToTwo(row.earned - row.paid),
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 10);

  const topUniversities: TopUniversityCommissionRow[] = Array.from(universityAccumulator.entries())
    .map(([universityName, grossCommission]) => ({
      universityName,
      grossCommission: roundToTwo(grossCommission),
    }))
    .sort((a, b) => b.grossCommission - a.grossCommission)
    .slice(0, 10);

  const commissionByCountry: CommissionCountryRow[] = Array.from(countryAccumulator.entries())
    .map(([country, grossCommission]) => ({
      country,
      grossCommission: roundToTwo(grossCommission),
    }))
    .sort((a, b) => b.grossCommission - a.grossCommission);

  const monthlyTrend: CommissionMonthlyTrendRow[] = monthKeys.map((key) => {
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const label = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });

    const bucket = monthlyMap.get(key) || { gross: 0, net: 0 };
    return {
      month: label,
      gross: roundToTwo(bucket.gross),
      net: roundToTwo(bucket.net),
    };
  });

  const applicationFeePaymentsRaw = await db.applicationFeePayment.findMany({
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      university: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const applicationFeePayments: ApplicationFeePaymentRow[] = applicationFeePaymentsRaw.map((row) => ({
    id: row.id,
    studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
    universityName: row.university?.name || "-",
    feeType: row.feeType,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paidBy: row.paidBy,
    paidByRole: row.paidByRole,
    date: row.paidAt?.toISOString() || row.createdAt.toISOString(),
  }));

  const applicationFeeSummary: ApplicationFeeSummary = {
    totalCollectedThisMonth: roundToTwo(
      applicationFeePaymentsRaw
        .filter((row) => row.status === "PAID" && row.paidAt && row.paidAt >= monthStart && row.paidAt < nextMonthStart)
        .reduce((sum, row) => sum + row.amount, 0),
    ),
    totalPending: roundToTwo(
      applicationFeePaymentsRaw
        .filter((row) => row.status === "PENDING")
        .reduce((sum, row) => sum + row.amount, 0),
    ),
    totalWaived: roundToTwo(
      applicationFeePaymentsRaw
        .filter((row) => row.status === "WAIVED")
        .reduce((sum, row) => sum + row.amount, 0),
    ),
    ucasGroupedPaymentsCount: new Set(
      applicationFeePaymentsRaw
        .filter((row) => !!row.ucasGroupId)
        .map((row) => row.ucasGroupId),
    ).size,
  };

  const [eligibilityRows, studentCount, completeAcademicCount] = await Promise.all([
    db.courseEligibilityResult.findMany({
      select: {
        matchStatus: true,
        matchScore: true,
        missingSubjects: true,
        student: {
          select: {
            nationality: true,
          },
        },
      },
    }),
    db.student.count(),
    db.student.count({
      where: {
        academicProfile: {
          is: {
            isComplete: true,
          },
        },
      },
    }),
  ]);

  const distributionMap = new Map<string, number>();
  const missingMap = new Map<string, number>();
  const nationalityMap = new Map<string, { totalScore: number; count: number }>();

  for (const row of eligibilityRows) {
    distributionMap.set(row.matchStatus, (distributionMap.get(row.matchStatus) || 0) + 1);

    for (const missing of row.missingSubjects || []) {
      const key = missing.trim();
      if (!key) continue;
      missingMap.set(key, (missingMap.get(key) || 0) + 1);
    }

    const nationality = row.student.nationality || "Unknown";
    const existing = nationalityMap.get(nationality) || { totalScore: 0, count: 0 };
    existing.totalScore += row.matchScore || 0;
    existing.count += 1;
    nationalityMap.set(nationality, existing);
  }

  const academicMatchDistribution: AcademicMatchDistributionRow[] = Array.from(distributionMap.entries()).map(
    ([status, count]) => ({ status, count }),
  );

  const commonMissingSubjects: CommonMissingSubjectRow[] = Array.from(missingMap.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const avgMatchScoreByNationality: AvgMatchScoreNationalityRow[] = Array.from(nationalityMap.entries())
    .map(([nationality, values]) => ({
      nationality,
      avgScore: values.count > 0 ? roundToTwo(values.totalScore / values.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 15);

  const profileCompletionRate = studentCount > 0 ? roundToTwo((completeAcademicCount / studentCount) * 100) : 0;

  const [scholarshipRows, scholarshipStatusRaw, scholarshipAwardRaw] = await Promise.all([
    db.studentScholarshipApplication.findMany({
      select: {
        status: true,
        createdAt: true,
        awardedAmount: true,
        scholarship: {
          select: {
            university: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    db.studentScholarshipApplication.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.studentScholarshipApplication.aggregate({
      where: { status: "AWARDED" },
      _sum: { awardedAmount: true },
      _count: { _all: true },
    }),
  ]);

  const scholarshipStatusCounts: ScholarshipStatusCountRow[] = scholarshipStatusRaw.map((row) => ({
    status: row.status,
    count: row._count._all,
  }));

  const scholarshipUniversityMap = new Map<string, { applications: number; awards: number; awardedAmount: number }>();
  const scholarshipMonthlyMap = new Map<string, number>();
  const scholarshipMonthKeys: string[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - i, 1, 0, 0, 0, 0));
    scholarshipMonthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  for (const key of scholarshipMonthKeys) {
    scholarshipMonthlyMap.set(key, 0);
  }

  let interestedCount = 0;
  let appliedCount = 0;
  let shortlistedCount = 0;
  let awardedCount = 0;
  let rejectedCount = 0;

  for (const row of scholarshipRows) {
    const universityName = row.scholarship.university.name;
    const existing = scholarshipUniversityMap.get(universityName) || { applications: 0, awards: 0, awardedAmount: 0 };
    existing.applications += 1;
    if (row.status === "AWARDED") {
      existing.awards += 1;
      existing.awardedAmount += row.awardedAmount || 0;
      awardedCount += 1;
    } else if (row.status === "INTERESTED") {
      interestedCount += 1;
    } else if (row.status === "APPLIED") {
      appliedCount += 1;
    } else if (row.status === "SHORTLISTED") {
      shortlistedCount += 1;
    } else if (row.status === "REJECTED") {
      rejectedCount += 1;
    }
    scholarshipUniversityMap.set(universityName, existing);

    const monthKey = `${row.createdAt.getUTCFullYear()}-${String(row.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    scholarshipMonthlyMap.set(monthKey, (scholarshipMonthlyMap.get(monthKey) || 0) + 1);
  }

  const topScholarshipUniversities: TopScholarshipUniversityRow[] = Array.from(scholarshipUniversityMap.entries())
    .map(([universityName, values]) => ({
      universityName,
      applications: values.applications,
      awards: values.awards,
      awardedAmount: roundToTwo(values.awardedAmount),
    }))
    .sort((a, b) => b.applications - a.applications)
    .slice(0, 10);

  const scholarshipMonthlyTrend: ScholarshipMonthlyTrendRow[] = scholarshipMonthKeys.map((key) => {
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const label = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });

    return {
      month: label,
      applications: scholarshipMonthlyMap.get(key) || 0,
    };
  });

  const scholarshipSummary: ScholarshipSummary = {
    interested: interestedCount,
    applied: appliedCount,
    shortlisted: shortlistedCount,
    awarded: awardedCount,
    rejected: rejectedCount,
    totalApplications: scholarshipRows.length,
    totalAwardedAmount: roundToTwo(scholarshipAwardRaw._sum.awardedAmount || 0),
    awardRate: scholarshipRows.length > 0 ? roundToTwo((awardedCount / scholarshipRows.length) * 100) : 0,
    applyRate: scholarshipRows.length > 0 ? roundToTwo((appliedCount / scholarshipRows.length) * 100) : 0,
  };

  const [applicationRows, applicationStatusChanges] = await Promise.all([
    db.application.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    }),
    db.activityLog.findMany({
      where: {
        entityType: "application",
        action: "status_change",
      },
      select: {
        entityId: true,
        createdAt: true,
        details: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const applicationPipelineCountsMap = new Map<string, number>();
  for (const stage of APPLICATION_STAGES) {
    applicationPipelineCountsMap.set(stage, 0);
  }

  for (const row of applicationRows) {
    applicationPipelineCountsMap.set(row.status, (applicationPipelineCountsMap.get(row.status) || 0) + 1);
  }

  const applicationPipelineCounts: ApplicationPipelineCountRow[] = APPLICATION_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: applicationPipelineCountsMap.get(stage) || 0,
  }));

  const reachedByStage = new Map<string, Set<string>>();
  const transitionCounts = new Map<string, number>();
  const appStageTimes = new Map<string, Map<string, Date>>();

  for (const stage of APPLICATION_STAGES) {
    reachedByStage.set(stage, new Set());
  }

  for (const app of applicationRows) {
    const times = new Map<string, Date>();
    times.set("APPLIED", app.createdAt);
    appStageTimes.set(app.id, times);
    reachedByStage.get("APPLIED")?.add(app.id);
    if (APPLICATION_STAGES.includes(app.status as (typeof APPLICATION_STAGES)[number])) {
      reachedByStage.get(app.status)?.add(app.id);
    }
  }

  for (const log of applicationStatusChanges) {
    let parsed: { fromStatus?: string; toStatus?: string } | null = null;

    if (typeof log.details === "string") {
      try {
        parsed = JSON.parse(log.details) as { fromStatus?: string; toStatus?: string };
      } catch {
        parsed = null;
      }
    } else if (log.details && typeof log.details === "object") {
      parsed = log.details as { fromStatus?: string; toStatus?: string };
    }

    const fromStatus = parsed?.fromStatus;
    const toStatus = parsed?.toStatus;

    if (!fromStatus || !toStatus) continue;
    if (!APPLICATION_STAGES.includes(fromStatus as (typeof APPLICATION_STAGES)[number])) continue;
    if (!APPLICATION_STAGES.includes(toStatus as (typeof APPLICATION_STAGES)[number])) continue;

    reachedByStage.get(fromStatus)?.add(log.entityId);
    reachedByStage.get(toStatus)?.add(log.entityId);

    const key = `${fromStatus}->${toStatus}`;
    transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);

    const times = appStageTimes.get(log.entityId) || new Map<string, Date>();
    if (!times.has(toStatus)) {
      times.set(toStatus, log.createdAt);
    }
    appStageTimes.set(log.entityId, times);
  }

  const applicationStageConversions: ApplicationStageConversionRow[] = [];
  for (let i = 0; i < APPLICATION_STAGES.length - 1; i++) {
    const from = APPLICATION_STAGES[i];
    const to = APPLICATION_STAGES[i + 1];
    const reached = reachedByStage.get(from)?.size || 0;
    const converted = transitionCounts.get(`${from}->${to}`) || 0;

    applicationStageConversions.push({
      fromStage: from,
      fromLabel: STAGE_LABELS[from],
      toStage: to,
      toLabel: STAGE_LABELS[to],
      reached,
      converted,
      conversionRate: reached > 0 ? roundToTwo((converted / reached) * 100) : 0,
    });
  }

  const durationPairs = APPLICATION_STAGES.slice(0, 11).map((stage, index) => ({
    from: stage,
    to: APPLICATION_STAGES[index + 1],
  }));

  const applicationStageDurations: ApplicationStageDurationRow[] = durationPairs.map(({ from, to }) => {
    let total = 0;
    let count = 0;

    for (const times of Array.from(appStageTimes.values())) {
      const fromAt = times.get(from);
      const toAt = times.get(to);
      if (!fromAt || !toAt) continue;
      const days = (toAt.getTime() - fromAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        total += days;
        count += 1;
      }
    }

    return {
      fromStage: from,
      fromLabel: STAGE_LABELS[from],
      toStage: to,
      toLabel: STAGE_LABELS[to],
      sampleSize: count,
      averageDays: count > 0 ? roundToTwo(total / count) : 0,
    };
  });

  type PreCasInterviewRow = {
    stage: string | null;
    outcome: string | null;
    bookedDate: Date | null;
    application: {
      id: string;
      student: {
        firstName: string;
        lastName: string;
        assignedCounsellor: { name: string | null; email: string } | null;
        subAgent: { agencyName: string } | null;
      };
      university: { name: string };
      course: { name: string };
    };
  };

  type VisaInterviewRow = {
    outcome: string | null;
    bookedDate: Date | null;
    application: {
      id: string;
      student: {
        firstName: string;
        lastName: string;
        assignedCounsellor: { name: string | null; email: string } | null;
        subAgent: { agencyName: string } | null;
      };
      university: { name: string };
      course: { name: string };
    };
  };

  const [preCasInterviews, visaInterviews] = await Promise.all([
    prismaWithInterview.preCasInterview.findMany({
      where: { isRequired: true },
      include: {
        application: {
          select: {
            id: true,
            student: {
              select: {
                firstName: true,
                lastName: true,
                assignedCounsellor: { select: { name: true, email: true } },
                subAgent: { select: { agencyName: true } },
              },
            },
            university: { select: { name: true } },
            course: { select: { name: true } },
          },
        },
      },
    }),
    prismaWithInterview.visaInterview.findMany({
      where: { isRequired: true },
      include: {
        application: {
          select: {
            id: true,
            student: {
              select: {
                firstName: true,
                lastName: true,
                assignedCounsellor: { select: { name: true, email: true } },
                subAgent: { select: { agencyName: true } },
              },
            },
            university: { select: { name: true } },
            course: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const preCasStageBreakdownMap = new Map<string, number>([
    ["BEFORE_OFFER", 0],
    ["AFTER_CONDITIONAL_OFFER", 0],
    ["DURING_CAS_ISSUE", 0],
  ]);
  const preCasOutcomeBreakdownMap = new Map<string, number>([
    ["PASSED", 0],
    ["FAILED", 0],
    ["RESCHEDULED", 0],
    ["CANCELLED_BY_UNIVERSITY", 0],
    ["NO_SHOW", 0],
  ]);
  const visaOutcomeBreakdownMap = new Map<string, number>([
    ["PASSED", 0],
    ["FAILED", 0],
    ["RESCHEDULED", 0],
    ["CANCELLED_BY_UNIVERSITY", 0],
    ["NO_SHOW", 0],
  ]);

  for (const row of preCasInterviews) {
    if (row.stage) preCasStageBreakdownMap.set(row.stage, (preCasStageBreakdownMap.get(row.stage) || 0) + 1);
    if (row.outcome) preCasOutcomeBreakdownMap.set(row.outcome, (preCasOutcomeBreakdownMap.get(row.outcome) || 0) + 1);
  }

  for (const row of visaInterviews) {
    if (row.outcome) visaOutcomeBreakdownMap.set(row.outcome, (visaOutcomeBreakdownMap.get(row.outcome) || 0) + 1);
  }

  const preCasTotalOutcomes = Array.from(preCasOutcomeBreakdownMap.values()).reduce((sum, value) => sum + value, 0);
  const visaTotalOutcomes = Array.from(visaOutcomeBreakdownMap.values()).reduce((sum, value) => sum + value, 0);

  const interviewSummary: InterviewSummary = {
    preCasRequired: preCasInterviews.length,
    visaRequired: visaInterviews.length,
    preCasPassRate: preCasTotalOutcomes > 0 ? roundToTwo(((preCasOutcomeBreakdownMap.get("PASSED") || 0) / preCasTotalOutcomes) * 100) : 0,
    visaPassRate: visaTotalOutcomes > 0 ? roundToTwo(((visaOutcomeBreakdownMap.get("PASSED") || 0) / visaTotalOutcomes) * 100) : 0,
  };

  const preCasStageBreakdown: InterviewBreakdownRow[] = [
    { key: "BEFORE_OFFER", label: "Before Offer", count: preCasStageBreakdownMap.get("BEFORE_OFFER") || 0 },
    { key: "AFTER_CONDITIONAL_OFFER", label: "After Conditional Offer", count: preCasStageBreakdownMap.get("AFTER_CONDITIONAL_OFFER") || 0 },
    { key: "DURING_CAS_ISSUE", label: "During CAS", count: preCasStageBreakdownMap.get("DURING_CAS_ISSUE") || 0 },
  ];

  const preCasOutcomeBreakdown: InterviewBreakdownRow[] = [
    { key: "PASSED", label: "Passed", count: preCasOutcomeBreakdownMap.get("PASSED") || 0 },
    { key: "FAILED", label: "Failed", count: preCasOutcomeBreakdownMap.get("FAILED") || 0 },
    { key: "RESCHEDULED", label: "Rescheduled", count: preCasOutcomeBreakdownMap.get("RESCHEDULED") || 0 },
    { key: "CANCELLED_BY_UNIVERSITY", label: "Cancelled", count: preCasOutcomeBreakdownMap.get("CANCELLED_BY_UNIVERSITY") || 0 },
    { key: "NO_SHOW", label: "No Show", count: preCasOutcomeBreakdownMap.get("NO_SHOW") || 0 },
  ];

  const visaOutcomeBreakdown: InterviewBreakdownRow[] = [
    { key: "PASSED", label: "Passed", count: visaOutcomeBreakdownMap.get("PASSED") || 0 },
    { key: "FAILED", label: "Failed", count: visaOutcomeBreakdownMap.get("FAILED") || 0 },
    { key: "RESCHEDULED", label: "Rescheduled", count: visaOutcomeBreakdownMap.get("RESCHEDULED") || 0 },
    { key: "CANCELLED_BY_UNIVERSITY", label: "Cancelled", count: visaOutcomeBreakdownMap.get("CANCELLED_BY_UNIVERSITY") || 0 },
    { key: "NO_SHOW", label: "No Show", count: visaOutcomeBreakdownMap.get("NO_SHOW") || 0 },
  ];

  const interviewRows: InterviewListRow[] = [
    ...preCasInterviews.map((row: PreCasInterviewRow) => ({
      applicationId: row.application.id,
      studentName: `${row.application.student.firstName} ${row.application.student.lastName}`.trim(),
      university: row.application.university.name,
      course: row.application.course.name,
      interviewType: "PRE_CAS" as const,
      stage: row.stage,
      bookedDate: row.bookedDate?.toISOString() || null,
      outcome: row.outcome,
      counsellor: row.application.student.assignedCounsellor?.name || row.application.student.assignedCounsellor?.email || null,
      subAgent: row.application.student.subAgent?.agencyName || null,
    })),
    ...visaInterviews.map((row: VisaInterviewRow) => ({
      applicationId: row.application.id,
      studentName: `${row.application.student.firstName} ${row.application.student.lastName}`.trim(),
      university: row.application.university.name,
      course: row.application.course.name,
      interviewType: "VISA" as const,
      stage: null,
      bookedDate: row.bookedDate?.toISOString() || null,
      outcome: row.outcome,
      counsellor: row.application.student.assignedCounsellor?.name || row.application.student.assignedCounsellor?.email || null,
      subAgent: row.application.student.subAgent?.agencyName || null,
    })),
  ];

  const mockInterviewRowsRaw = await db.mockInterview.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { not: null },
      report: { isNot: null },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedCounsellor: { select: { name: true, email: true } },
          subAgent: { select: { agencyName: true } },
        },
      },
      application: {
        select: {
          course: {
            select: {
              name: true,
              university: { select: { name: true } },
            },
          },
        },
      },
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
        },
      },
    },
    orderBy: [{ completedAt: "desc" }],
  });

  const mockInterviewDetails: MockInterviewDetailRow[] = mockInterviewRowsRaw
    .filter((row) => !!row.completedAt && !!row.report)
    .map((row) => ({
      interviewId: row.id,
      studentId: row.student.id,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      university: row.application.course.university.name,
      course: row.application.course.name,
      interviewType: row.interviewType,
      counsellor: row.student.assignedCounsellor?.name || row.student.assignedCounsellor?.email || null,
      subAgent: row.student.subAgent?.agencyName || null,
      completedAt: row.completedAt!.toISOString(),
      overallScore: row.report!.overallScore,
      isPassed: row.report!.isPassed,
      recommendation: row.report!.recommendation,
      reportDocumentUrl: row.reportDocumentUrl,
    }));

  const mockMonthlyMap = new Map<string, { completed: number; passed: number; failed: number }>();
  for (const row of mockInterviewDetails) {
    const key = row.completedAt.slice(0, 7);
    const entry = mockMonthlyMap.get(key) || { completed: 0, passed: 0, failed: 0 };
    entry.completed += 1;
    if (row.isPassed) entry.passed += 1;
    else entry.failed += 1;
    mockMonthlyMap.set(key, entry);
  }

  const mockInterviewMonthlyRows: MockInterviewMonthlyRow[] = Array.from(mockMonthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, agg]) => ({
      month,
      completed: agg.completed,
      passed: agg.passed,
      failed: agg.failed,
      passRate: agg.completed > 0 ? roundToTwo((agg.passed / agg.completed) * 100) : 0,
    }));

  const chatSessionsRaw = await db.chatSession.findMany({
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const sessionsThisMonth = chatSessionsRaw.filter((session) => session.startedAt >= monthStart && session.startedAt < nextMonthStart);
  const leadsCapturedThisMonth = sessionsThisMonth.filter((session) => session.leadCaptured).length;

  let totalDurationMinutes = 0;
  let durationCount = 0;
  const languageMap = new Map<string, number>();
  const questionMap = new Map<string, number>();

  const eduviChatSessions: EduviChatSessionRow[] = chatSessionsRaw.slice(0, 150).map((session) => {
    const startedAt = session.startedAt;
    const endedAt = session.endedAt || session.messages.at(-1)?.createdAt || startedAt;
    const durationMinutes = (endedAt.getTime() - startedAt.getTime()) / (1000 * 60);
    if (durationMinutes >= 0) {
      totalDurationMinutes += durationMinutes;
      durationCount += 1;
    }

    languageMap.set(session.language || "en", (languageMap.get(session.language || "en") || 0) + 1);

    for (const message of session.messages) {
      if (message.role !== "USER") continue;
      const normalized = message.content.replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      const question = normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized;
      questionMap.set(question, (questionMap.get(question) || 0) + 1);
    }

    const personName = session.student
      ? `${session.student.firstName} ${session.student.lastName}`.trim()
      : (session.visitorId ? `Visitor ${session.visitorId.slice(0, 8)}` : "Visitor");

    return {
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
      personName,
      sessionType: session.sessionType,
      messagesExchanged: session.messages.length,
      leadCaptured: session.leadCaptured,
      language: session.language || "en",
    };
  });

  const eduviCommonQuestions: EduviCommonQuestionRow[] = Array.from(questionMap.entries())
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const eduviLanguageUsage: EduviLanguageUsageRow[] = Array.from(languageMap.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  const eduviChatSummary: EduviChatSummary = {
    totalSessionsThisMonth: sessionsThisMonth.length,
    leadsCapturedThisMonth,
    leadConversionRate: sessionsThisMonth.length > 0 ? roundToTwo((leadsCapturedThisMonth / sessionsThisMonth.length) * 100) : 0,
    averageSessionDurationMinutes: durationCount > 0 ? roundToTwo(totalDurationMinutes / durationCount) : 0,
  };

  return (
    <ReportsClient
      visaStatusCounts={visaStatusCounts}
      countryApprovalRows={countryApprovalRows}
      averageDaysToDecision={averageDaysToDecision}
      upcomingAppointments={upcomingAppointments}
      commissionRevenueSummary={revenueSummary}
      topSubAgents={topSubAgents}
      topUniversities={topUniversities}
      commissionByCountry={commissionByCountry}
      monthlyCommissionTrend={monthlyTrend}
      applicationFeeSummary={applicationFeeSummary}
      applicationFeePayments={applicationFeePayments}
      academicMatchDistribution={academicMatchDistribution}
      commonMissingSubjects={commonMissingSubjects}
      profileCompletionRate={profileCompletionRate}
      avgMatchScoreByNationality={avgMatchScoreByNationality}
      scholarshipStatusCounts={scholarshipStatusCounts}
      topScholarshipUniversities={topScholarshipUniversities}
      scholarshipMonthlyTrend={scholarshipMonthlyTrend}
      scholarshipSummary={scholarshipSummary}
      applicationPipelineCounts={applicationPipelineCounts}
      applicationStageConversions={applicationStageConversions}
      applicationStageDurations={applicationStageDurations}
      interviewSummary={interviewSummary}
      preCasStageBreakdown={preCasStageBreakdown}
      preCasOutcomeBreakdown={preCasOutcomeBreakdown}
      visaOutcomeBreakdown={visaOutcomeBreakdown}
      interviewRows={interviewRows}
      mockInterviewMonthlyRows={mockInterviewMonthlyRows}
      mockInterviewDetails={mockInterviewDetails}
      eduviChatSummary={eduviChatSummary}
      eduviCommonQuestions={eduviCommonQuestions}
      eduviLanguageUsage={eduviLanguageUsage}
      eduviChatSessions={eduviChatSessions}
    />
  );
}
