import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ChatSessionType, ChatStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEduviResponse } from "@/lib/eduvi-engine";
import { getActiveEduviKnowledgeBase, seedEduviKnowledgeBaseIfEmpty } from "@/lib/eduvi-knowledge-base";

async function loadStudentContext(studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      assignedCounsellor: {
        select: {
          name: true,
          email: true,
        },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          status: true,
          course: {
            select: {
              name: true,
              university: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!student) return undefined;

  const latestChecklist = await db.documentChecklist.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        where: {
          status: { in: ["PENDING", "REJECTED"] },
        },
        select: {
          label: true,
        },
        take: 10,
      },
    },
  });

  return {
    name: `${student.firstName} ${student.lastName}`.trim(),
    nationality: student.nationality,
    applications: student.applications.map((application) => ({
      university: application.course.university.name,
      course: application.course.name,
      stage: application.status,
    })),
    pendingDocuments: latestChecklist?.items.map((item) => item.label) || [],
    counsellorName: student.assignedCounsellor?.name || student.assignedCounsellor?.email || null,
  };
}

function extractLeadContext(history: Array<{ role: string; content: string }>) {
  const context: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
    studyInterest?: string;
    country?: string;
    requestedCounsellor?: boolean;
  } = {};

  for (const turn of history) {
    if (turn.role !== "USER") continue;
    const line = turn.content;

    const emailMatch = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch && !context.email) context.email = emailMatch[0];

    const phoneMatch = line.match(/(\+?\d[\d\s\-()]{7,}\d)/);
    if (phoneMatch && !context.phone) context.phone = phoneMatch[0].trim();

    if (!context.requestedCounsellor) {
      const lower = line.toLowerCase();
      if (lower.includes("counsellor") || lower.includes("human") || lower.includes("agent")) {
        context.requestedCounsellor = true;
      }
    }
  }

  return context;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = (await req.json()) as {
      sessionId?: string;
      message?: string;
      isVoice?: boolean;
      language?: string;
    };

    if (!body.sessionId || !body.message?.trim()) {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
    }

    const chatSession = await db.chatSession.findUnique({
      where: { id: body.sessionId },
      select: {
        id: true,
        userId: true,
        studentId: true,
        sessionType: true,
        language: true,
        status: true,
      },
    });

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (chatSession.sessionType !== ChatSessionType.PUBLIC_VISITOR) {
      if (!session?.user?.id || chatSession.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (chatSession.status === ChatStatus.ENDED) {
      return NextResponse.json({ error: "Session has ended" }, { status: 400 });
    }

    const language = (body.language || chatSession.language || "en").toLowerCase();

    await db.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "USER",
        content: body.message.trim().slice(0, 500),
        language,
        isVoice: Boolean(body.isVoice),
      },
    });

    const conversationHistory = await db.chatMessage.findMany({
      where: { sessionId: chatSession.id },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        content: true,
        language: true,
        createdAt: true,
      },
    });

    await seedEduviKnowledgeBaseIfEmpty(session?.user?.id || "system");
    const knowledgeBase = await getActiveEduviKnowledgeBase();

    const studentContext = chatSession.studentId ? await loadStudentContext(chatSession.studentId) : undefined;

    const assistant = await getEduviResponse({
      message: body.message.trim(),
      sessionType: chatSession.sessionType,
      conversationHistory,
      studentContext,
      language,
      knowledgeBase,
      leadContext: extractLeadContext(conversationHistory),
    });

    const createdAssistantMessage = await db.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "ASSISTANT",
        content: assistant.response,
        language: assistant.language,
      },
      select: {
        id: true,
        content: true,
        language: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: {
        message: createdAssistantMessage,
        actions: {
          shouldCaptureLead: assistant.shouldCaptureLead,
          shouldHandoff: assistant.shouldHandoff,
        },
      },
    });
  } catch (error) {
    console.error("[/api/chat/message POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
