import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MOCK_INTERVIEW_ROUNDS } from "@/lib/mock-interview-questions";

export const dynamic = "force-dynamic";

const READ_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

const createSchema = z.object({
  roundNumber: z.number().int().min(1).max(10),
  roundName: z.string().min(1),
  questionText: z.string().min(1),
  followUpQuestion: z.string().optional(),
  evaluationCriteria: z.string().optional(),
  redFlags: z.string().optional(),
  isActive: z.boolean().optional(),
});

async function seedQuestionBankIfEmpty(createdBy: string) {
  const existingCount = await db.mockInterviewQuestion.count();
  if (existingCount > 0) return;

  await db.mockInterviewQuestion.createMany({
    data: MOCK_INTERVIEW_ROUNDS.flatMap((round) =>
      round.questions.map((question, index) => ({
        roundNumber: round.roundNumber,
        roundName: round.roundName,
        questionText: question.question,
        followUpQuestion: question.followUp,
        evaluationCriteria: question.evaluationCriteria,
        redFlags: question.redFlags,
        isActive: true,
        orderIndex: index + 1,
        createdBy,
      })),
    ),
  });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !READ_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await seedQuestionBankIfEmpty(session.user.id);

    const rows = await db.mockInterviewQuestion.findMany({
      orderBy: [{ roundNumber: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        roundNumber: true,
        roundName: true,
        questionText: true,
        followUpQuestion: true,
        evaluationCriteria: true,
        redFlags: true,
        isActive: true,
        orderIndex: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const rounds = Array.from({ length: 10 }, (_, index) => {
      const roundNumber = index + 1;
      const staticRound = MOCK_INTERVIEW_ROUNDS.find((round) => round.roundNumber === roundNumber);
      return {
        roundNumber,
        roundName: staticRound?.roundName || `Round ${roundNumber}`,
        questions: rows.filter((row) => row.roundNumber === roundNumber),
      };
    });

    return NextResponse.json({ data: { rounds } });
  } catch (error) {
    console.error("[/api/admin/settings/mock-interview-questions GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const maxOrder = await db.mockInterviewQuestion.aggregate({
      where: { roundNumber: parsed.data.roundNumber },
      _max: { orderIndex: true },
    });

    const created = await db.mockInterviewQuestion.create({
      data: {
        roundNumber: parsed.data.roundNumber,
        roundName: parsed.data.roundName,
        questionText: parsed.data.questionText,
        followUpQuestion: parsed.data.followUpQuestion || null,
        evaluationCriteria: parsed.data.evaluationCriteria || null,
        redFlags: parsed.data.redFlags || null,
        isActive: parsed.data.isActive ?? true,
        orderIndex: (maxOrder._max.orderIndex || 0) + 1,
        createdBy: session.user.id,
      },
      select: {
        id: true,
        roundNumber: true,
        roundName: true,
        questionText: true,
        followUpQuestion: true,
        evaluationCriteria: true,
        redFlags: true,
        isActive: true,
        orderIndex: true,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[/api/admin/settings/mock-interview-questions POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
