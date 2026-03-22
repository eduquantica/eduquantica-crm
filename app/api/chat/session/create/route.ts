import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ChatSessionType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function getGreeting(sessionType: ChatSessionType) {
  if (sessionType === ChatSessionType.PUBLIC_VISITOR || sessionType === ChatSessionType.LOGGED_IN_STUDENT) {
    return "Hi there! 👋 I am Eduvi, your personal education assistant at EduQuantica. Whether you want to study in the UK, USA, Canada, or Australia - I am here to help! What brings you here today?";
  }

  return "Hello team! I am Eduvi, your internal EduQuantica assistant. I can help with student status checks, visa rules, and drafting responses. What do you need right now?";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = (await req.json()) as {
      sessionType?: ChatSessionType;
      language?: string;
      visitorId?: string;
    };

    const sessionType = body.sessionType;
    if (!sessionType || !Object.values(ChatSessionType).includes(sessionType)) {
      return NextResponse.json({ error: "Invalid sessionType" }, { status: 400 });
    }

    if (sessionType !== ChatSessionType.PUBLIC_VISITOR && !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    let studentId: string | null = null;

    if (sessionType === ChatSessionType.LOGGED_IN_STUDENT && session?.user?.id) {
      const student = await db.student.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
        },
      });

      if (!student) {
        return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
      }

      studentId = student.id;
    }

    const language = (body.language || "en").toLowerCase().slice(0, 10);

    const createdSession = await db.chatSession.create({
      data: {
        sessionType,
        userId: session?.user?.id || null,
        studentId,
        visitorId: body.visitorId || null,
        language,
      },
      select: {
        id: true,
      },
    });

    const greeting = getGreeting(sessionType);

    await db.chatMessage.create({
      data: {
        sessionId: createdSession.id,
        role: "ASSISTANT",
        content: greeting,
        language,
        isVoice: false,
      },
    });

    return NextResponse.json({
      data: {
        sessionId: createdSession.id,
        greeting,
        language,
      },
    });
  } catch (error) {
    console.error("[/api/chat/session/create POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
