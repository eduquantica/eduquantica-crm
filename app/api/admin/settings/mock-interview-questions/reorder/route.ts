import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const reorderSchema = z.object({
  roundNumber: z.number().int().min(1).max(10),
  orderedIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = reorderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const existing = await db.mockInterviewQuestion.findMany({
      where: { roundNumber: parsed.data.roundNumber },
      select: { id: true },
    });

    if (existing.length !== parsed.data.orderedIds.length) {
      return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
    }

    const existingIds = new Set(existing.map((row) => row.id));
    if (parsed.data.orderedIds.some((id) => !existingIds.has(id))) {
      return NextResponse.json({ error: "Invalid question IDs for selected round" }, { status: 400 });
    }

    await db.$transaction(
      parsed.data.orderedIds.map((id, index) =>
        db.mockInterviewQuestion.update({
          where: { id },
          data: { orderIndex: index + 1 },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/admin/settings/mock-interview-questions/reorder POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
