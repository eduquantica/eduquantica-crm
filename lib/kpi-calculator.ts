import { KpiPeriod } from "@prisma/client";
import { db } from "@/lib/db";

type Args = {
  staffId: string;
  period: KpiPeriod;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  kpiTargetId: string;
};

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function safeAchievement(actual: number, target: number) {
  if (!target || target <= 0) return actual > 0 ? 100 : 0;
  return (actual / target) * 100;
}

export async function calculateKpiResults(args: Args) {
  const { staffId, period, periodLabel, startDate, endDate, kpiTargetId } = args;

  const target = await db.kpiTarget.findUnique({ where: { id: kpiTargetId } });
  if (!target) throw new Error("KPI target not found");

  const [
    leadsContacted,
    leadsConverted,
    totalStudents,
    studentsWithOffer,
    depositPaid,
    visaApplied,
    enrolled,
  ] = await Promise.all([
    db.lead.count({
      where: {
        assignedCounsellorId: staffId,
        status: { not: "NEW" },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    db.student.count({
      where: {
        assignedCounsellorId: staffId,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    db.student.count({
      where: {
        assignedCounsellorId: staffId,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    db.application.count({
      where: {
        counsellorId: staffId,
        status: { in: ["CONDITIONAL_OFFER", "UNCONDITIONAL_OFFER"] },
        OR: [
          { conditionalOfferAt: { gte: startDate, lte: endDate } },
          { unconditionalOfferAt: { gte: startDate, lte: endDate } },
          { offerReceivedAt: { gte: startDate, lte: endDate } },
        ],
      },
    }),
    db.application.count({
      where: {
        counsellorId: staffId,
        status: "DEPOSIT_PAID",
        OR: [
          { financeCompleteAt: { gte: startDate, lte: endDate } },
          { submittedAt: { gte: startDate, lte: endDate } },
        ],
      },
    }),
    db.application.count({
      where: {
        counsellorId: staffId,
        status: "VISA_APPLIED",
        visaAppliedAt: { gte: startDate, lte: endDate },
      },
    }),
    db.application.count({
      where: {
        counsellorId: staffId,
        status: "ENROLLED",
        enrolledAt: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const leadContactRate = pct(leadsContacted, Math.max(leadsContacted, 1));
  const leadToStudentRate = pct(leadsConverted, leadsContacted);
  const studentToOfferRate = pct(studentsWithOffer, totalStudents);
  const offerToDepositRate = pct(depositPaid, studentsWithOffer);
  const depositToVisaRate = pct(visaApplied, depositPaid);
  const visaToEnrolledRate = pct(enrolled, visaApplied);
  const overallConversionRate = pct(enrolled, leadsContacted);

  const achievementValues = [
    safeAchievement(leadsContacted, target.targetLeadsContacted),
    safeAchievement(leadToStudentRate, target.targetLeadToStudent),
    safeAchievement(studentToOfferRate, target.targetStudentToOffer),
    safeAchievement(offerToDepositRate, target.targetOfferToDeposit),
    safeAchievement(depositToVisaRate, target.targetDepositToVisa),
    safeAchievement(visaToEnrolledRate, target.targetVisaToEnrolled),
    safeAchievement(overallConversionRate, target.targetOverallConversion),
    safeAchievement(enrolled, target.targetEnrollments),
  ];

  const achievementPercentage = Math.round((achievementValues.reduce((sum, value) => sum + value, 0) / achievementValues.length) * 100) / 100;

  const existing = await db.kpiResult.findFirst({
    where: { kpiTargetId, staffId, periodLabel },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    return db.kpiResult.update({
      where: { id: existing.id },
      data: {
        period,
        periodLabel,
        startDate,
        endDate,
        actualLeadsContacted: leadsContacted,
        actualLeadsConverted: leadsConverted,
        actualStudentsWithOffer: studentsWithOffer,
        actualDepositPaid: depositPaid,
        actualVisaApplied: visaApplied,
        actualEnrolled: enrolled,
        leadContactRate,
        leadToStudentRate,
        studentToOfferRate,
        offerToDepositRate,
        depositToVisaRate,
        visaToEnrolledRate,
        overallConversionRate,
        achievementPercentage,
        calculatedAt: new Date(),
      },
    });
  }

  return db.kpiResult.create({
    data: {
      kpiTargetId,
      staffId,
      period,
      periodLabel,
      startDate,
      endDate,
      actualLeadsContacted: leadsContacted,
      actualLeadsConverted: leadsConverted,
      actualStudentsWithOffer: studentsWithOffer,
      actualDepositPaid: depositPaid,
      actualVisaApplied: visaApplied,
      actualEnrolled: enrolled,
      leadContactRate,
      leadToStudentRate,
      studentToOfferRate,
      offerToDepositRate,
      depositToVisaRate,
      visaToEnrolledRate,
      overallConversionRate,
      achievementPercentage,
      calculatedAt: new Date(),
    },
  });
}
