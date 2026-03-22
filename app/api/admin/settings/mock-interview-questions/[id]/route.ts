import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  roundNumber: z.number().int().min(1).max(10).optional(),
  roundName: z.string().min(1).optional(),
  questionText: z.string().min(1).optional(),
  followUpQuestion: z.string().nullable().optional(),
  evaluationCriteria: z.string().nullable().optional(),
  redFlags: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const existing = await db.mockInterviewQuestion.findUnique({
      where: { id: params.id },
      select: { id: true, roundNumber: true, orderIndex: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const targetRoundNumber = parsed.data.roundNumber ?? existing.roundNumber;
    let targetOrderIndex = existing.orderIndex;

    if (targetRoundNumber !== existing.roundNumber) {
      const maxOrder = await db.mockInterviewQuestion.aggregate({
        where: { roundNumber: targetRoundNumber },
        _max: { orderIndex: true },
      });
      targetOrderIndex = (maxOrder._max.orderIndex || 0) + 1;
    }

    const updated = await db.mockInterviewQuestion.update({
      where: { id: params.id },
      data: {
        roundNumber: targetRoundNumber,
        roundName: parsed.data.roundName,
        questionText: parsed.data.questionText,
        followUpQuestion: parsed.data.followUpQuestion,
        evaluationCriteria: parsed.data.evaluationCriteria,
        redFlags: parsed.data.redFlags,
        isActive: parsed.data.isActive,
        orderIndex: targetOrderIndex,
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

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[/api/admin/settings/mock-interview-questions/[id] PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
