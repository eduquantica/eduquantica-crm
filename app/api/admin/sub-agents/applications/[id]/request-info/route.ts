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
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const attachmentUrl =
    typeof body.attachmentUrl === "string" ? body.attachmentUrl.trim() || null : null;

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  try {
    const agent = await db.$transaction(async (tx) => {
      const updated = await tx.subAgent.updateMany({
        where: { id, approvalStatus: { in: ["PENDING", "INFO_REQUESTED"] } },
        data: { approvalStatus: "INFO_REQUESTED" },
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

      await tx.subAgentInfoRequest.create({
        data: {
          subAgentId: id,
          adminId: session.user.id,
          adminMessage: message,
          adminAttachmentUrl: attachmentUrl,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: id,
          action: "INFO_REQUESTED",
          details: `Admin requested additional information: "${message.slice(0, 120)}${message.length > 120 ? "…" : ""}"`,
        },
      });

      return found;
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    await sendMail({
      to: agent.user.email,
      subject: "EduQuantica — Additional Information Required",
      text: [
        `Hi ${agent.user.name ?? agent.agencyName},`,
        "",
        "Our team requires some additional information before we can process your application.",
        "",
        `Message from EduQuantica: ${message}`,
        "",
        "Please log in to review and respond:",
        `${base}/agent/pending`,
        "",
        "The EduQuantica Team",
      ].join("\n"),
    }).catch(() => {});

    await NotificationService.createNotification({
      userId: agent.userId,
      type: "SUB_AGENT_APPLICATION_INFO_REQUESTED",
      message: "Additional information is required for your partner application.",
      linkUrl: "/agent/pending",
      actorUserId: session.user.id,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CONFLICT")
      return NextResponse.json({ error: "Application is not in a pending state." }, { status: 409 });
    console.error("[request-info]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
