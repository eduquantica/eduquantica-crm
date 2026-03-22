import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { SubAgentTier } from "@prisma/client";
import { getSubAgentTierSnapshot, issueSubAgentTierCertificate } from "@/lib/subagent-tier";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("editRate"), rate: z.number().min(0) }),
  z.object({ action: z.literal("assignContact"), contactUserId: z.string().optional().nullable() }),
  z.object({
    action: z.literal("setTierOverride"),
    tier: z.enum(["SILVER", "GOLD", "PLATINUM"]),
    reason: z.string().min(3),
  }),
  z.object({ action: z.literal("issueCertificateNow") }),
  z.object({ action: z.literal("regenerateCertificate") }),
]);

const TIER_LABEL: Record<string, "GOLD" | "SILVER" | "PLATINUM"> = {
  STANDARD: "GOLD",
  SILVER: "SILVER",
  PLATINUM: "PLATINUM",
};

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function parseJsonObject(input: string | null | undefined) {
  if (!input) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      agencyName: true,
      firstName: true,
      lastName: true,
      roleAtAgency: true,
      businessEmail: true,
      primaryDialCode: true,
      agencyCountry: true,
      agencyCity: true,
      phone: true,
      website: true,
      expectedMonthlySubmissions: true,
      heardAboutUs: true,
      registrationDocUrl: true,
      commissionRate: true,
      isApproved: true,
      approvedAt: true,
      approvalStatus: true,
      tier: true,
      tierAchievedAt: true,
      certificateIssuedAt: true,
      certificateUrl: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      agreement: {
        select: {
          currentTier: true,
          currentRate: true,
          silverThreshold: true,
          platinumThreshold: true,
          intakePeriod: true,
          enrolmentsThisIntake: true,
          manualTierOverride: true,
          overrideReason: true,
          notes: true,
          isActive: true,
        },
      },
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const [students, commissions, contacts, certificateHistory, tierSnapshot] = await Promise.all([
    db.student.findMany({
      where: { subAgentId: subAgent.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.commission.findMany({
      where: { subAgentId: subAgent.id },
      select: {
        id: true,
        currency: true,
        tuitionFee: true,
        universityCommRate: true,
        grossCommission: true,
        agentRateAtTime: true,
        agentAmount: true,
        eduquanticaNet: true,
        status: true,
        createdAt: true,
        application: {
          select: {
            student: { select: { firstName: true, lastName: true } },
            course: {
              select: {
                name: true,
                university: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ["ADMIN", "MANAGER", "COUNSELLOR"] } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.subAgentTierCertificate.findMany({
      where: { subAgentId: params.id },
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
        createdAt: true,
      },
    }),
    getSubAgentTierSnapshot(params.id).catch(() => null),
  ]);

  const notesObj = parseJsonObject(subAgent.agreement?.notes);
  const assignedContactId = (notesObj.assignedContactId as string | undefined) || null;

  return NextResponse.json({
    data: {
      viewerRole: session.user.roleName,
      header: {
        id: subAgent.id,
        agencyName: subAgent.agencyName,
        contactName: `${subAgent.firstName || ""} ${subAgent.lastName || ""}`.trim() || subAgent.user.name || "-",
        country: subAgent.agencyCountry || "-",
        email: subAgent.businessEmail || subAgent.user.email,
        phone: subAgent.phone || "-",
        approvalDate: subAgent.approvedAt,
        status: subAgent.isApproved ? "APPROVED" : "SUSPENDED",
      },
      overview: {
        ...subAgent,
      },
      agreement: {
        currentTier: TIER_LABEL[subAgent.agreement?.currentTier || "STANDARD"] || "GOLD",
        currentRate: Math.min(subAgent.agreement?.currentRate ?? subAgent.commissionRate ?? 80, 90),
        silverThreshold: subAgent.agreement?.silverThreshold ?? 10,
        platinumThreshold: subAgent.agreement?.platinumThreshold ?? 20,
        intakePeriod: subAgent.agreement?.intakePeriod || "",
        enrolmentsThisIntake: subAgent.agreement?.enrolmentsThisIntake ?? 0,
        manualTierOverride: subAgent.agreement?.manualTierOverride ?? false,
        overrideReason: subAgent.agreement?.overrideReason || "",
        isActive: subAgent.agreement?.isActive ?? subAgent.isApproved,
        assignedContactId,
      },
      certificate: {
        tier: subAgent.tier,
        tierAchievedAt: subAgent.tierAchievedAt,
        certificateIssuedAt: subAgent.certificateIssuedAt,
        certificateUrl: subAgent.certificateUrl,
        kpiAchievementPercentage: tierSnapshot?.achievementPct ?? 0,
        history: certificateHistory,
      },
      contacts,
      students: students.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        email: student.email,
        latestApplicationStatus: student.applications[0]?.status || "-",
      })),
      commissions: commissions.map((commission) => ({
        id: commission.id,
        studentName: `${commission.application.student.firstName} ${commission.application.student.lastName}`.trim(),
        university: commission.application.course.university.name,
        course: commission.application.course.name,
        currency: commission.currency,
        tuitionFee: commission.tuitionFee,
        universityCommRate: commission.universityCommRate,
        grossCommission: commission.grossCommission,
        agentRate: commission.agentRateAtTime,
        agentAmount: commission.agentAmount,
        eduquanticaNet: commission.eduquanticaNet,
        status: commission.status,
        createdAt: commission.createdAt,
      })),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  const subAgent = await db.subAgent.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  if ((body.action === "suspend" || body.action === "activate") && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Only ADMIN can suspend/activate sub-agents" }, { status: 403 });
  }

  if (body.action === "editRate") {
    if (body.rate > 90) {
      return NextResponse.json({ error: "Commission rate cannot exceed 90%" }, { status: 400 });
    }

    const rate = Math.min(body.rate, 90);
    await db.$transaction(async (tx) => {
      await tx.subAgent.update({ where: { id: params.id }, data: { commissionRate: rate, isApproved: true, approvalStatus: "APPROVED" } });
      await tx.subAgentAgreement.upsert({
        where: { subAgentId: params.id },
        create: { subAgentId: params.id, currentRate: rate, currentTier: "STANDARD", isActive: true },
        update: { currentRate: rate, isActive: true },
      });
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: params.id,
          action: "RATE_UPDATED",
          details: `Updated commission rate to ${rate}%`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "assignContact") {
    await db.$transaction(async (tx) => {
      const agreement = await tx.subAgentAgreement.findUnique({ where: { subAgentId: params.id }, select: { notes: true } });
      const notesObj = parseJsonObject(agreement?.notes);
      if (body.contactUserId) notesObj.assignedContactId = body.contactUserId;
      else delete notesObj.assignedContactId;

      await tx.subAgentAgreement.upsert({
        where: { subAgentId: params.id },
        create: {
          subAgentId: params.id,
          currentTier: "STANDARD",
          currentRate: 80,
          notes: JSON.stringify(notesObj),
        },
        update: {
          notes: JSON.stringify(notesObj),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: params.id,
          action: "ASSIGNED_CONTACT_UPDATED",
          details: `Assigned EduQuantica contact updated to ${body.contactUserId || "none"}`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "setTierOverride") {
    if (session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Only ADMIN can manually set tier" }, { status: 403 });
    }

    const issued = await issueSubAgentTierCertificate({
      subAgentId: params.id,
      tier: body.tier as SubAgentTier,
      reason: body.reason,
      isManual: true,
      createdBy: session.user.id,
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "SubAgent",
        entityId: params.id,
        action: "CERTIFICATE_TIER_OVERRIDE",
        details: `Manual tier override to ${body.tier}. Reason: ${body.reason}. Certificate: ${issued.certificateNumber}`,
      },
    });

    return NextResponse.json({ ok: true, data: issued });
  }

  if (body.action === "issueCertificateNow") {
    if (session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Only ADMIN can issue certificate manually" }, { status: 403 });
    }

    const issued = await issueSubAgentTierCertificate({
      subAgentId: params.id,
      reason: "Manual certificate issuance by admin",
      isManual: true,
      createdBy: session.user.id,
    });

    return NextResponse.json({ ok: true, data: issued });
  }

  if (body.action === "regenerateCertificate") {
    if (session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Only ADMIN can regenerate certificate" }, { status: 403 });
    }

    const subAgentTier = await db.subAgent.findUnique({
      where: { id: params.id },
      select: { tier: true },
    });

    if (!subAgentTier) {
      return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
    }

    if (!subAgentTier.tier) {
      return NextResponse.json({ error: "No certificate available before SILVER tier is achieved" }, { status: 400 });
    }

    const issued = await issueSubAgentTierCertificate({
      subAgentId: params.id,
      tier: subAgentTier.tier,
      reason: "Certificate regenerated by admin",
      isManual: true,
      createdBy: session.user.id,
    });

    return NextResponse.json({ ok: true, data: issued });
  }

  if (body.action === "suspend") {
    await db.$transaction(async (tx) => {
      await tx.subAgent.update({
        where: { id: params.id },
        data: {
          isApproved: false,
          approvalStatus: "APPROVED",
          revokedAt: new Date(),
          revokedBy: session.user.id,
        },
      });
      await tx.subAgentAgreement.updateMany({ where: { subAgentId: params.id }, data: { isActive: false } });
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: params.id,
          action: "SUSPENDED",
          details: "Sub-agent suspended by admin",
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "activate") {
    await db.$transaction(async (tx) => {
      await tx.subAgent.update({
        where: { id: params.id },
        data: {
          isApproved: true,
          approvalStatus: "APPROVED",
        },
      });
      await tx.subAgentAgreement.updateMany({ where: { subAgentId: params.id }, data: { isActive: true } });
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: params.id,
          action: "ACTIVATED",
          details: "Sub-agent activated by admin",
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
