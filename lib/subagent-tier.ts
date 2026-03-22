import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SubAgentTier } from "@prisma/client";
import { UTApi } from "uploadthing/server";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";

type TierResult = {
  subAgentId: string;
  tier: SubAgentTier | null;
  previousTier: SubAgentTier | null;
  changed: boolean;
  upgraded: boolean;
  kpiAchievementPercentage: number;
};

const TIER_ORDER: Record<SubAgentTier, number> = {
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
};

const TIER_TARGETS: Record<SubAgentTier, number> = {
  SILVER: 80,
  GOLD: 85,
  PLATINUM: 90,
};

const TIER_COLORS: Record<SubAgentTier | "NO_TIER", string> = {
  NO_TIER: "#64748B",
  SILVER: "#C0C0C0",
  GOLD: "#FFD700",
  PLATINUM: "#E5E4E2",
};

function tierLabel(tier: SubAgentTier | null) {
  return tier || "NO_TIER";
}

function tierOrder(tier: SubAgentTier | null) {
  if (!tier) return 0;
  return TIER_ORDER[tier];
}

function hexToRgb(hex: string) {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  return rgb(r, g, b);
}

function parsePeriodBounds(intakePeriod?: string | null) {
  if (!intakePeriod || !/^\d{4}-\d{2}$/.test(intakePeriod)) return null;
  const [yearRaw, monthRaw] = intakePeriod.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) return null;

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  return { start, end };
}

function toSubAgentCode(subAgent: { referralCode: string | null; agencyName: string; id: string }) {
  const fromReferral = (subAgent.referralCode || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (fromReferral.length >= 4) return fromReferral.slice(0, 8);

  const fromAgency = subAgent.agencyName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (fromAgency.length >= 4) return fromAgency.slice(0, 8);

  return subAgent.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
}

function calculateTierFromKpi(achievementPct: number): SubAgentTier | null {
  if (achievementPct >= 90) return "PLATINUM";
  if (achievementPct >= 85) return "GOLD";
  if (achievementPct >= 80) return "SILVER";
  return null;
}

async function uploadCertificatePdf(fileName: string, bytes: Uint8Array) {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) throw new Error("UPLOADTHING_TOKEN is required to upload tier certificates");

  const utapi = new UTApi({ token });
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], fileName, { type: "application/pdf" });
  const uploaded = await utapi.uploadFiles(file);

  if (uploaded.error || !uploaded.data?.url) {
    throw new Error(uploaded.error?.message || "Failed to upload sub-agent tier certificate");
  }

  return uploaded.data.url;
}

async function createCertificatePdf(args: {
  agencyName: string;
  tier: SubAgentTier;
  certificateNumber: string;
  issuedAt: Date;
  validUntil: Date;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();

  const navy = hexToRgb("#1B2A4A");
  const gold = hexToRgb("#F5A623");
  const tierColor = hexToRgb(TIER_COLORS[args.tier]);

  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: navy, borderWidth: 3 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: gold, borderWidth: 1.5 });

  page.drawRectangle({ x: width / 2 - 130, y: height - 78, width: 260, height: 34, color: navy });
  page.drawText("EduQuantica", {
    x: width / 2 - 52,
    y: height - 56,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText("Authorised Education Partner Certificate", {
    x: width / 2 - 205,
    y: height - 120,
    size: 24,
    font: bold,
    color: navy,
  });

  page.drawText(args.agencyName, {
    x: width / 2 - 220,
    y: height - 192,
    size: 32,
    font: bold,
    color: navy,
    maxWidth: 440,
  });

  page.drawRectangle({
    x: width / 2 - 110,
    y: height - 250,
    width: 220,
    height: 40,
    color: tierColor,
  });

  page.drawText(`${args.tier} PARTNER`, {
    x: width / 2 - 80,
    y: height - 226,
    size: 16,
    font: bold,
    color: navy,
  });

  page.drawText(
    `This certifies that ${args.agencyName} has been recognised as an EduQuantica ${args.tier} Partner`,
    {
      x: 70,
      y: height - 300,
      size: 13,
      font: regular,
      color: rgb(0.15, 0.2, 0.28),
      maxWidth: width - 140,
    },
  );

  page.drawText("in the field of international student recruitment and education consultancy.", {
    x: 120,
    y: height - 322,
    size: 13,
    font: regular,
    color: rgb(0.15, 0.2, 0.28),
    maxWidth: width - 240,
  });

  if (args.tier === "PLATINUM") {
    page.drawText("Platinum recognition includes our premium partner distinction with a signature shimmer finish.", {
      x: 108,
      y: height - 348,
      size: 10,
      font: regular,
      color: rgb(0.4, 0.42, 0.48),
    });
  }

  page.drawText(`Issue Date: ${args.issuedAt.toLocaleDateString("en-GB")}`, {
    x: 92,
    y: 136,
    size: 11,
    font: bold,
    color: navy,
  });

  page.drawText(`Valid Until: ${args.validUntil.toLocaleDateString("en-GB")}`, {
    x: 92,
    y: 116,
    size: 11,
    font: bold,
    color: navy,
  });

  page.drawText(`Certificate Number: ${args.certificateNumber}`, {
    x: 92,
    y: 96,
    size: 10,
    font: regular,
    color: rgb(0.3, 0.34, 0.42),
  });

  page.drawLine({ start: { x: width - 300, y: 124 }, end: { x: width - 92, y: 124 }, thickness: 1, color: navy });
  page.drawText("EduQuantica Authorised Signature", {
    x: width - 286,
    y: 106,
    size: 10,
    font: regular,
    color: rgb(0.3, 0.34, 0.42),
  });

  return Buffer.from(await pdf.save());
}

async function createCertificateNumber(subAgent: { id: string; referralCode: string | null; agencyName: string }, tier: SubAgentTier) {
  const year = new Date().getFullYear();
  const code = toSubAgentCode(subAgent);
  const base = `EQ-${year}-${code}-${tier}`;

  const existingCount = await db.subAgentTierCertificate.count({
    where: {
      certificateNumber: {
        startsWith: base,
      },
    },
  });

  if (existingCount === 0) return base;
  return `${base}-${existingCount + 1}`;
}

async function issueTierCertificate(args: {
  subAgentId: string;
  tier: SubAgentTier;
  achievementPct: number;
  reason?: string;
  isManual?: boolean;
  createdBy?: string;
}) {
  const subAgent = await db.subAgent.findUnique({
    where: { id: args.subAgentId },
    select: {
      id: true,
      referralCode: true,
      agencyName: true,
    },
  });

  if (!subAgent) throw new Error("Sub-agent not found");

  const issuedAt = new Date();
  const validUntil = new Date(issuedAt);
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const certificateNumber = await createCertificateNumber(subAgent, args.tier);
  const pdfBytes = await createCertificatePdf({
    agencyName: subAgent.agencyName,
    tier: args.tier,
    certificateNumber,
    issuedAt,
    validUntil,
  });

  const fileName = `${certificateNumber}.pdf`;
  const certificateUrl = await uploadCertificatePdf(fileName, pdfBytes);

  await db.$transaction(async (tx) => {
    await tx.subAgent.update({
      where: { id: args.subAgentId },
      data: {
        certificateUrl,
        certificateIssuedAt: issuedAt,
      },
    });

    await tx.subAgentTierCertificate.create({
      data: {
        subAgentId: args.subAgentId,
        tier: args.tier,
        certificateNumber,
        certificateUrl,
        issuedAt,
        validUntil,
        achievementPct: Number(args.achievementPct.toFixed(2)),
        reason: args.reason || null,
        isManual: !!args.isManual,
        createdBy: args.createdBy || null,
      },
    });
  });

  return {
    certificateNumber,
    certificateUrl,
    issuedAt,
    validUntil,
  };
}

async function calculateKpiAchievementPercentage(subAgentId: string) {
  const agreement = await db.subAgentAgreement.findUnique({
    where: { subAgentId },
    select: {
      intakePeriod: true,
      platinumThreshold: true,
    },
  });

  const bounds = parsePeriodBounds(agreement?.intakePeriod || null);
  const enrolledCount = await db.application.count({
    where: {
      status: "ENROLLED",
      student: { subAgentId },
      ...(bounds ? { createdAt: { gte: bounds.start, lt: bounds.end } } : {}),
    },
  });

  const target = agreement?.platinumThreshold && agreement.platinumThreshold > 0
    ? agreement.platinumThreshold
    : 20;

  const pct = Math.min(100, (enrolledCount / target) * 100);
  return Number(pct.toFixed(2));
}

async function notifyTierUpgrade(args: {
  subAgentId: string;
  subAgentUserId: string;
  subAgentEmail: string | null;
  agencyName: string;
  tier: SubAgentTier;
}) {
  await NotificationService.createNotification({
    userId: args.subAgentUserId,
    type: "SUB_AGENT_TIER_UPGRADED",
    message: `Congratulations! You have reached ${args.tier} Partner status. Your new certificate is ready to download.`,
    linkUrl: "/agent/certificate",
  }).catch(() => undefined);

  if (args.subAgentEmail) {
    await sendResendEmail({
      to: args.subAgentEmail,
      subject: `Congratulations! You have reached ${args.tier} Partner status`,
      html: `<p>Congratulations!</p><p>You have reached <strong>${args.tier}</strong> Partner status.</p><p>Your new certificate is ready to download in your agent portal.</p>`,
    }).catch(() => undefined);
  }

  const admins = await db.user.findMany({
    where: {
      role: { name: { in: ["ADMIN", "MANAGER"] } },
      isActive: true,
    },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      NotificationService.createNotification({
        userId: admin.id,
        type: "SUB_AGENT_TIER_UPGRADED",
        message: `${args.agencyName} has reached ${args.tier} status.`,
        linkUrl: `/dashboard/sub-agents/${args.subAgentId}`,
      }).catch(() => undefined),
    ),
  );
}

export async function calculateSubAgentTier(subAgentId: string): Promise<TierResult> {
  const subAgent = await db.subAgent.findUnique({
    where: { id: subAgentId },
    select: {
      id: true,
      agencyName: true,
      tier: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!subAgent) {
    throw new Error("Sub-agent not found");
  }

  const previousTier = subAgent.tier;
  const kpiAchievementPercentage = await calculateKpiAchievementPercentage(subAgentId);
  const nextTier = calculateTierFromKpi(kpiAchievementPercentage);
  const changed = previousTier !== nextTier;
  const upgraded = tierOrder(nextTier) > tierOrder(previousTier);

  if (changed) {
    await db.subAgent.update({
      where: { id: subAgentId },
      data: {
        tier: nextTier,
        tierAchievedAt: nextTier ? new Date() : null,
      },
    });

    await db.activityLog.create({
      data: {
        userId: subAgent.userId,
        entityType: "sub_agent_tier",
        entityId: subAgentId,
        action: "tier_recalculated",
        details: `Tier changed from ${tierLabel(previousTier)} to ${tierLabel(nextTier)} based on KPI ${kpiAchievementPercentage}%.`,
      },
    }).catch(() => undefined);
  }

  if (upgraded && nextTier) {
    try {
      await issueTierCertificate({
        subAgentId,
        tier: nextTier,
        achievementPct: kpiAchievementPercentage,
        reason: "Tier upgraded by KPI auto-calculation",
      });
    } catch (error) {
      console.error("Failed to issue sub-agent tier certificate", error);
    }

    await notifyTierUpgrade({
      subAgentId,
      subAgentUserId: subAgent.userId,
      subAgentEmail: subAgent.user?.email || null,
      agencyName: subAgent.agencyName,
      tier: nextTier,
    }).catch(() => undefined);
  }

  return {
    subAgentId,
    tier: nextTier,
    previousTier,
    changed,
    upgraded,
    kpiAchievementPercentage,
  };
}

export async function issueSubAgentTierCertificate(args: {
  subAgentId: string;
  tier?: SubAgentTier;
  reason?: string;
  isManual?: boolean;
  createdBy?: string;
}) {
  const subAgent = await db.subAgent.findUnique({
    where: { id: args.subAgentId },
    select: {
      id: true,
      tier: true,
      userId: true,
      agencyName: true,
      user: { select: { email: true } },
    },
  });

  if (!subAgent) throw new Error("Sub-agent not found");

  const tier = args.tier || subAgent.tier;

  if (!tier) {
    throw new Error("Tier certificate can only be issued for SILVER, GOLD, or PLATINUM.");
  }

  if (args.tier && args.tier !== subAgent.tier) {
    await db.subAgent.update({
      where: { id: args.subAgentId },
      data: {
        tier: args.tier,
        tierAchievedAt: new Date(),
      },
    });
  }

  const kpiAchievementPercentage = await calculateKpiAchievementPercentage(args.subAgentId);

  const certificate = await issueTierCertificate({
    subAgentId: args.subAgentId,
    tier,
    achievementPct: kpiAchievementPercentage,
    reason: args.reason,
    isManual: args.isManual,
    createdBy: args.createdBy,
  });

  await db.activityLog.create({
    data: {
      userId: args.createdBy || subAgent.userId,
      entityType: "sub_agent_tier",
      entityId: args.subAgentId,
      action: "certificate_issued",
      details: `Issued ${tier} certificate (${certificate.certificateNumber}).`,
    },
  }).catch(() => undefined);

  if (subAgent.user?.email) {
    await sendResendEmail({
      to: subAgent.user.email,
      subject: `Congratulations! You have reached ${tier} Partner status`,
      html: `<p>Your new certificate is ready to download.</p><p><a href="${certificate.certificateUrl}">Download Certificate</a></p>`,
    }).catch(() => undefined);
  }

  await NotificationService.createNotification({
    userId: subAgent.userId,
    type: "SUB_AGENT_TIER_CERTIFICATE_READY",
    message: `Your ${tier} partner certificate is ready to download.`,
    linkUrl: "/agent/certificate",
  }).catch(() => undefined);

  return certificate;
}

export async function getSubAgentTierSnapshot(subAgentId: string) {
  const [subAgent, history, achievementPct] = await Promise.all([
    db.subAgent.findUnique({
      where: { id: subAgentId },
      select: {
        id: true,
        agencyName: true,
        tier: true,
        tierAchievedAt: true,
        certificateIssuedAt: true,
        certificateUrl: true,
        agreement: {
          select: {
            silverThreshold: true,
            platinumThreshold: true,
          },
        },
      },
    }),
    db.subAgentTierCertificate.findMany({
      where: { subAgentId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        tier: true,
        certificateNumber: true,
        certificateUrl: true,
        issuedAt: true,
        validUntil: true,
        achievementPct: true,
        reason: true,
        isManual: true,
      },
    }),
    calculateKpiAchievementPercentage(subAgentId),
  ]);

  if (!subAgent) return null;

  const current = subAgent.tier;
  const nextTier = !current
    ? "SILVER"
    : current === "SILVER"
      ? "GOLD"
      : current === "GOLD"
        ? "PLATINUM"
        : null;

  const nextTarget = nextTier ? TIER_TARGETS[nextTier] : null;

  return {
    subAgent,
    achievementPct,
    nextTier,
    nextTarget,
    history,
    colors: TIER_COLORS,
  };
}

export async function recalculateAllSubAgentTiers() {
  const subAgents = await db.subAgent.findMany({
    where: {
      isApproved: true,
    },
    select: { id: true },
  });

  const results = [] as TierResult[];
  for (const item of subAgents) {
    try {
      const result = await calculateSubAgentTier(item.id);
      results.push(result);
    } catch (error) {
      console.error("Failed to recalculate sub-agent tier", item.id, error);
    }
  }

  return {
    total: subAgents.length,
    processed: results.length,
    changed: results.filter((row) => row.changed).length,
    upgraded: results.filter((row) => row.upgraded).length,
    results,
  };
}
