import { NextRequest, NextResponse } from "next/server";
import { ChatStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getNextCounsellor } from "@/lib/counsellor";
import { NotificationService } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      message?: string;
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const chatSession = await db.chatSession.findUnique({
      where: { id: body.sessionId },
      select: {
        id: true,
        leadId: true,
      },
    });

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let assignedCounsellorId: string | null = null;

    if (chatSession.leadId) {
      const lead = await db.lead.findUnique({
        where: { id: chatSession.leadId },
        select: { assignedCounsellorId: true },
      });
      assignedCounsellorId = lead?.assignedCounsellorId || null;
    }

    if (!assignedCounsellorId) {
      const nextCounsellor = await getNextCounsellor();
      assignedCounsellorId = nextCounsellor?.id || null;

      if (assignedCounsellorId && chatSession.leadId) {
        await db.lead.update({
          where: { id: chatSession.leadId },
          data: { assignedCounsellorId },
        }).catch(() => undefined);
      }
    }

    await db.chatSession.update({
      where: { id: chatSession.id },
      data: {
        status: ChatStatus.HANDED_OFF,
      },
    });

    if (body.message?.trim()) {
      await db.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: "USER",
          content: `[Counsellor handoff message] ${body.message.trim()}`,
          language: "en",
          isVoice: false,
        },
      });
    }

    if (assignedCounsellorId) {
      await NotificationService.createNotification({
        userId: assignedCounsellorId,
        type: "CHATBOT_HANDOFF_REQUESTED",
        message: "A visitor requested to speak with a counsellor via Eduvi chatbot.",
        linkUrl: "/dashboard/leads",
      }).catch(() => undefined);
    }

    return NextResponse.json({
      data: {
        handedOff: true,
        assignedCounsellorId,
      },
    });
  } catch (error) {
    console.error("[/api/chat/handoff POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
