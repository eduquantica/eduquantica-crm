import { AgentTier } from "@prisma/client";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";

export type TierLabel = "GOLD" | "SILVER" | "PLATINUM";

const DB_TO_LABEL: Record<AgentTier, TierLabel> = {
  STANDARD: "GOLD",
  SILVER: "SILVER",
  PLATINUM: "PLATINUM",
};

const LABEL_TO_DB: Record<TierLabel, AgentTier> = {
  GOLD: AgentTier.STANDARD,
  SILVER: AgentTier.SILVER,
  PLATINUM: AgentTier.PLATINUM,
};

const TIER_RATE: Record<TierLabel, number> = {
  GOLD: 80,
  SILVER: 85,
  PLATINUM: 90,
};

function parseIntakeBounds(intakePeriod?: string | null) {
  if (!intakePeriod || !/^\d{4}-\d{2}$/.test(intakePeriod)) return null;
  const [yearRaw, monthRaw] = intakePeriod.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) return null;

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  return { start, end };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export class CommissionService {
  static async calculateTier(subAgentId: string, intakePeriod?: string | null): Promise<TierLabel> {
    const agreement = await db.subAgentAgreement.findUnique({
      where: { subAgentId },
      select: {
        currentTier: true,
        silverThreshold: true,
        platinumThreshold: true,
        manualTierOverride: true,
      },
    });

    if (!agreement) return "GOLD";

    if (agreement.manualTierOverride) {
      return DB_TO_LABEL[agreement.currentTier];
    }

    const bounds = parseIntakeBounds(intakePeriod);
    const enrolledCount = await db.application.count({
      where: {
        status: "ENROLLED",
        student: { subAgentId },
        ...(bounds ? { createdAt: { gte: bounds.start, lt: bounds.end } } : {}),
      },
    });

    const silverThreshold = agreement.silverThreshold ?? Number.MAX_SAFE_INTEGER;
    const platinumThreshold = agreement.platinumThreshold ?? Number.MAX_SAFE_INTEGER;

    if (enrolledCount >= platinumThreshold) return "PLATINUM";
    if (enrolledCount >= silverThreshold) return "SILVER";
    return "GOLD";
  }

  static async getCurrentRate(subAgentId: string): Promise<number> {
    const agreement = await db.subAgentAgreement.findUnique({
      where: { subAgentId },
      select: { intakePeriod: true },
    });

    const tier = await CommissionService.calculateTier(subAgentId, agreement?.intakePeriod);
    const rate = TIER_RATE[tier];
    return Math.min(rate, 90);
  }

  static async calculateCommission(applicationId: string): Promise<{
    grossCommission: number;
    agentRate: number;
    agentAmount: number;
    eduquanticaNet: number;
  }> {
    const application = await db.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        universityId: true,
        course: { select: { tuitionFee: true } },
        student: { select: { subAgentId: true } },
      },
    });

    if (!application) throw new Error("Application not found");

    const tuitionFee = application.course.tuitionFee ?? 0;

    const universityAgreement = await db.universityCommissionAgreement.findFirst({
      where: { universityId: application.universityId, isActive: true },
      select: { commissionRate: true },
    });

    if (!universityAgreement) {
      throw new Error("University commission agreement not found");
    }

    const grossCommission = roundMoney(tuitionFee * (universityAgreement.commissionRate / 100));

    const subAgentId = application.student.subAgentId;
    if (!subAgentId) {
      return {
        grossCommission,
        agentRate: 0,
        agentAmount: 0,
        eduquanticaNet: grossCommission,
      };
    }

    const agentRate = Math.min(await CommissionService.getCurrentRate(subAgentId), 90);
    const agentAmount = roundMoney(grossCommission * (agentRate / 100));
    const eduquanticaNet = roundMoney(grossCommission - agentAmount);

    return {
      grossCommission,
      agentRate,
      agentAmount,
      eduquanticaNet,
    };
  }

  static async updateTierAfterEnrolment(subAgentId: string): Promise<void> {
    const agreement = await db.subAgentAgreement.findUnique({
      where: { subAgentId },
      select: {
        currentTier: true,
        intakePeriod: true,
        subAgent: {
          select: {
            id: true,
            agencyName: true,
            userId: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!agreement) return;

    await db.subAgentAgreement.update({
      where: { subAgentId },
      data: { enrolmentsThisIntake: { increment: 1 } },
    });

    const previousTier = DB_TO_LABEL[agreement.currentTier];
    const recalculatedTier = await CommissionService.calculateTier(subAgentId, agreement.intakePeriod);

    if (previousTier === recalculatedTier) return;

    const nextRate = Math.min(TIER_RATE[recalculatedTier], 90);

    await db.$transaction(async (tx) => {
      await tx.subAgentAgreement.update({
        where: { subAgentId },
        data: {
          currentTier: LABEL_TO_DB[recalculatedTier],
          currentRate: nextRate,
        },
      });

      await tx.subAgent.update({
        where: { id: subAgentId },
        data: { commissionRate: nextRate },
      });

      await tx.notification.create({
        data: {
          userId: agreement.subAgent.userId,
          type: "COMMISSION_TIER_UPDATED",
          message: `Your commission tier changed from ${previousTier} to ${recalculatedTier}. New rate: ${nextRate}%.`,
          linkUrl: "/agent/dashboard",
        },
      });

      await tx.activityLog.create({
        data: {
          userId: agreement.subAgent.userId,
          entityType: "SubAgentAgreement",
          entityId: subAgentId,
          action: "TIER_CHANGED",
          details: `Tier changed from ${previousTier} to ${recalculatedTier}. Current rate ${nextRate}%.`,
        },
      });
    });

    const subAgentEmail = agreement.subAgent.user.email;
    if (subAgentEmail) {
      await sendResendEmail({
        to: subAgentEmail,
        subject: "Your commission tier has been updated",
        html: `<p>Hello ${agreement.subAgent.user.name ?? agreement.subAgent.agencyName},</p><p>Your commission tier has changed from <strong>${previousTier}</strong> to <strong>${recalculatedTier}</strong>.</p><p>Your current payout rate is now <strong>${nextRate}%</strong>.</p>`,
      }).catch((error) => {
        console.error("Failed to send tier change email", error);
      });
    }
  }
}
