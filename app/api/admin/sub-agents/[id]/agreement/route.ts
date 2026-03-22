import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AgentTier } from "@prisma/client";
import { z } from "zod";
import { calculateSubAgentTier } from "@/lib/subagent-tier";

const schema = z.object({
  silverThreshold: z.number().int().min(0),
  platinumThreshold: z.number().int().min(0),
  intakePeriod: z.string().optional().default(""),
  manualTierOverride: z.boolean(),
  forcedTier: z.enum(["GOLD", "SILVER", "PLATINUM"]).optional(),
  overrideReason: z.string().optional().default(""),
});

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

const tierToDb: Record<"GOLD" | "SILVER" | "PLATINUM", AgentTier> = {
  GOLD: AgentTier.STANDARD,
  SILVER: AgentTier.SILVER,
  PLATINUM: AgentTier.PLATINUM,
};

const tierRate: Record<"GOLD" | "SILVER" | "PLATINUM", number> = {
  GOLD: 80,
  SILVER: 85,
  PLATINUM: 90,
};

function parsePeriodBounds(intakePeriod?: string) {
  if (!intakePeriod || !/^\d{4}-\d{2}$/.test(intakePeriod)) return null;
  const [yearStr, monthStr] = intakePeriod.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) return null;

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  return { start, end };
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

  const payload = parsed.data;

  if (payload.platinumThreshold < payload.silverThreshold) {
    return NextResponse.json({ error: "Platinum threshold must be greater than or equal to silver threshold" }, { status: 400 });
  }

  if (payload.manualTierOverride) {
    if (session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Only ADMIN can use manual override" }, { status: 403 });
    }
    if (!payload.forcedTier) {
      return NextResponse.json({ error: "Forced tier is required when manual override is enabled" }, { status: 400 });
    }
    if (!payload.overrideReason.trim()) {
      return NextResponse.json({ error: "Override reason is required" }, { status: 400 });
    }
  }

  const subAgent = await db.subAgent.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const period = parsePeriodBounds(payload.intakePeriod);
  const enrolmentsThisIntake = await db.application.count({
    where: {
      status: "ENROLLED",
      student: { subAgentId: params.id },
      ...(period ? { createdAt: { gte: period.start, lt: period.end } } : {}),
    },
  });

  let tierLabel: "GOLD" | "SILVER" | "PLATINUM" = "GOLD";
  if (payload.manualTierOverride && payload.forcedTier) {
    tierLabel = payload.forcedTier;
  } else if (enrolmentsThisIntake >= payload.platinumThreshold) {
    tierLabel = "PLATINUM";
  } else if (enrolmentsThisIntake >= payload.silverThreshold) {
    tierLabel = "SILVER";
  }

  const rate = Math.min(tierRate[tierLabel], 90);

  await db.$transaction(async (tx) => {
    await tx.subAgentAgreement.upsert({
      where: { subAgentId: params.id },
      create: {
        subAgentId: params.id,
        currentTier: tierToDb[tierLabel],
        currentRate: rate,
        silverThreshold: payload.silverThreshold,
        platinumThreshold: payload.platinumThreshold,
        intakePeriod: payload.intakePeriod || null,
        enrolmentsThisIntake,
        manualTierOverride: payload.manualTierOverride,
        overrideReason: payload.manualTierOverride ? payload.overrideReason : null,
        overrideBy: payload.manualTierOverride ? session.user.id : null,
        isActive: true,
      },
      update: {
        currentTier: tierToDb[tierLabel],
        currentRate: rate,
        silverThreshold: payload.silverThreshold,
        platinumThreshold: payload.platinumThreshold,
        intakePeriod: payload.intakePeriod || null,
        enrolmentsThisIntake,
        manualTierOverride: payload.manualTierOverride,
        overrideReason: payload.manualTierOverride ? payload.overrideReason : null,
        overrideBy: payload.manualTierOverride ? session.user.id : null,
      },
    });

    await tx.subAgent.update({
      where: { id: params.id },
      data: { commissionRate: rate },
    });

    if (payload.manualTierOverride) {
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: params.id,
          action: "KPI_OVERRIDE",
          details: `Tier manually overridden to ${tierLabel} (${rate}%). Reason: ${payload.overrideReason}. Date: ${new Date().toISOString()}`,
        },
      });
    } else {
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: params.id,
          action: "KPI_UPDATED",
          details: `KPI agreement updated. Tier recalculated to ${tierLabel} (${rate}%). Intake=${payload.intakePeriod || "all"}; enrolments=${enrolmentsThisIntake}.`,
        },
      });
    }
  });

  await calculateSubAgentTier(params.id).catch((error) => {
    console.error("Failed to recalculate sub-agent recognition tier after agreement update", error);
  });

  return NextResponse.json({ ok: true, data: { tier: tierLabel, rate, enrolmentsThisIntake } });
}
