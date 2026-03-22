import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.subAgent.updateMany({
        where: { id, approvalStatus: "REJECTED" },
        data: { approvalStatus: "PENDING" },
      });

      if (updated.count === 0) throw new Error("CONFLICT");

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: id,
          action: "RECONSIDERED",
          details: "Application moved back to Pending for reconsideration.",
        },
      });
    });

    const subAgent = await db.subAgent.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (subAgent?.userId) {
      await NotificationService.createNotification({
        userId: subAgent.userId,
        type: "SUB_AGENT_APPLICATION_RECONSIDERED",
        message: "Your application is back under review.",
        linkUrl: "/agent/pending",
        actorUserId: session.user.id,
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CONFLICT")
      return NextResponse.json({ error: "Application is not currently rejected." }, { status: 409 });
    console.error("[reconsider]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
