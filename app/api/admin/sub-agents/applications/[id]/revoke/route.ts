import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { NotificationService } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json({ error: "Revoke reason is required." }, { status: 400 });
  }

  try {
    const agent = await db.$transaction(async (tx) => {
      const updated = await tx.subAgent.updateMany({
        where: { id, approvalStatus: "APPROVED" },
        data: {
          isApproved: false,
          approvalStatus: "PENDING",
          revokedAt: new Date(),
          revokedBy: session.user.id,
          revokeReason: reason,
        },
      });

      if (updated.count === 0) throw new Error("CONFLICT");

      const found = await tx.subAgent.findUnique({
        where: { id },
        select: {
          userId: true,
          agencyName: true,
          user: { select: { email: true, name: true } },
        },
      });
      if (!found) throw new Error("NOT_FOUND");

      // Deactivate the agreement if one exists
      await tx.subAgentAgreement.updateMany({
        where: { subAgentId: id },
        data: { isActive: false },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: id,
          action: "REVOKED",
          details: `Access revoked. Reason: ${reason}`,
        },
      });

      return found;
    });

    await sendMail({
      to: agent.user.email,
      subject: "EduQuantica — Partner Access Update",
      text: [
        `Hi ${agent.user.name ?? agent.agencyName},`,
        "",
        "We're writing to inform you that your EduQuantica Recruitment Partner access has been suspended.",
        "",
        `Reason: ${reason}`,
        "",
        "If you believe this is an error, please contact us.",
        "",
        "The EduQuantica Team",
      ].join("\n"),
    }).catch(() => {});

    await NotificationService.createNotification({
      userId: agent.userId,
      type: "SUB_AGENT_APPLICATION_REVOKED",
      message: `Your partner access was suspended. Reason: ${reason}`,
      linkUrl: "/agent/pending",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CONFLICT")
      return NextResponse.json({ error: "Application is not currently approved." }, { status: 409 });
    console.error("[revoke]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
