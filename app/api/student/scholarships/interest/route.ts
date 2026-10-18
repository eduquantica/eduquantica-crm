import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { registerScholarshipInterest } from "@/lib/scholarship-website";

const schema = z.object({ scholarshipId: z.string().min(1).max(64) });

/** Adds a scholarship chosen on the public website to the logged-in student's tracker. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scholarship" }, { status: 400 });
  }

  const result = await registerScholarshipInterest(student.id, parsed.data.scholarshipId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      created: result.created,
      scholarship: {
        id: result.scholarship.id,
        name: result.scholarship.name,
        university: result.scholarship.university.name,
        course: result.scholarship.course,
      },
    },
  });
}
