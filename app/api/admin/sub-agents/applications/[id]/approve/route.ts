import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { randomBytes } from "crypto";
import { NotificationService } from "@/lib/notifications";

const TIER_RATE: Record<string, number> = {
  GOLD: 80,
  SILVER: 85,
  PLATINUM: 90,
};

const TIER_TO_DB: Record<string, "STANDARD" | "SILVER" | "PLATINUM"> = {
  GOLD: "STANDARD",
  SILVER: "SILVER",
  PLATINUM: "PLATINUM",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const tierRaw = typeof body.tier === "string" ? body.tier.toUpperCase() : "GOLD";
  const tier = tierRaw in TIER_RATE ? tierRaw : "GOLD";
  const commissionRate = TIER_RATE[tier];
  const welcomeNote =
    typeof body.welcomeNote === "string" ? body.welcomeNote.trim() : "";

  try {
    const result = await db.$transaction(async (tx) => {
      // Status-guarded update prevents race conditions
      const updated = await tx.subAgent.updateMany({
        where: { id, approvalStatus: { in: ["PENDING", "INFO_REQUESTED"] } },
        data: {
          isApproved: true,
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedBy: session.user.id,
          commissionRate,
        },
      });

      if (updated.count === 0) throw new Error("CONFLICT");

      const agent = await tx.subAgent.findUnique({
        where: { id },
        select: {
          agencyName: true,
          user: { select: { id: true, email: true, name: true, password: true } },
        },
      });
      if (!agent) throw new Error("NOT_FOUND");

      // Upsert agreement so portal is immediately functional
      await tx.subAgentAgreement.upsert({
        where: { subAgentId: id },
        create: {
          subAgentId: id,
          currentRate: commissionRate,
          currentTier: TIER_TO_DB[tier],
          isActive: true,
        },
        update: { currentRate: commissionRate, currentTier: TIER_TO_DB[tier], isActive: true },
      });

      // If user has no password (legacy flow), issue set-password token
      let token: string | null = null;
      if (!agent.user.password) {
        token = randomBytes(32).toString("hex");
        await tx.passwordResetToken.create({
          data: {
            userId: agent.user.id,
            token,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: id,
          action: "APPROVED",
          details: `Approved. Tier: ${tier}. Commission rate: ${commissionRate}%.${welcomeNote ? ` Note: ${welcomeNote}` : ""}`,
        },
      });

      return { agent, token };
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const loginUrl = `${base}/login`;
    const setPasswordUrl = result.token ? `${base}/reset-password?token=${result.token}` : null;

    await sendMail({
      to: result.agent.user.email,
      subject: "Welcome to EduQuantica — Your Application is Approved",
      text: [
        `Hi ${result.agent.user.name ?? result.agent.agencyName},`,
        "",
        "Congratulations! Your Recruitment Partner application has been approved.",
        "",
        ...(setPasswordUrl
          ? [
              "Set up your password to access the partner portal:",
              setPasswordUrl,
              "",
              "This link expires in 48 hours.",
            ]
          : ["You can now log in to the partner portal:", loginUrl]),
        ...(welcomeNote ? ["", `Message from EduQuantica: ${welcomeNote}`] : []),
        "",
        "Welcome aboard,",
        "The EduQuantica Team",
      ].join("\n"),
    }).catch(() => {});

    await NotificationService.createNotification({
      userId: result.agent.user.id,
      type: "SUB_AGENT_APPLICATION_APPROVED",
      message: "Your partner application was approved.",
      linkUrl: "/agent/pending",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CONFLICT")
      return NextResponse.json({ error: "Application is not in a pending state." }, { status: 409 });
    console.error("[approve]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
