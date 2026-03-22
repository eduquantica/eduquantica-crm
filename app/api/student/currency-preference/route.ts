import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const patchSchema = z.object({
  preferredCurrency: z.string().trim().min(1).max(10).nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { preferredCurrency: true, nationality: true },
  });

  if (!student) return NextResponse.json({ error: "Not a student" }, { status: 404 });

  return NextResponse.json({
    data: {
      preferredCurrency: student.preferredCurrency,
      nationality: student.nationality,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Not a student" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await db.student.update({
      where: { id: student.id },
      data: { preferredCurrency: parsed.data.preferredCurrency?.toUpperCase() ?? null },
      select: { preferredCurrency: true, nationality: true },
    });

    return NextResponse.json({
      data: {
        preferredCurrency: updated.preferredCurrency,
        nationality: updated.nationality,
      },
    });
  } catch (error) {
    console.error("[/api/student/currency-preference PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
