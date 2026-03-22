import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ChatSessionType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteParams = {
  params: {
    sessionId: string;
  };
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    const chatSession = await db.chatSession.findUnique({
      where: { id: params.sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            language: true,
            isVoice: true,
            createdAt: true,
          },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (chatSession.sessionType !== ChatSessionType.PUBLIC_VISITOR) {
      const isStaff = session?.user?.roleName === "ADMIN" || session?.user?.roleName === "MANAGER" || session?.user?.roleName === "COUNSELLOR";
      const isOwner = session?.user?.id && session.user.id === chatSession.userId;
      if (!isStaff && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({
      data: {
        session: {
          id: chatSession.id,
          sessionType: chatSession.sessionType,
          language: chatSession.language,
          status: chatSession.status,
          leadCaptured: chatSession.leadCaptured,
          leadId: chatSession.leadId,
          startedAt: chatSession.startedAt,
          endedAt: chatSession.endedAt,
        },
        messages: chatSession.messages,
      },
    });
  } catch (error) {
    console.error("[/api/chat/session/[sessionId]/history GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
