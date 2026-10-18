import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { registerCourseInterest } from "@/lib/course-website";

const schema = z.object({ courseId: z.string().min(1).max(64) });

/** Saves a course chosen on the public website to the logged-in student's wishlist. */
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
    return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  }

  const result = await registerCourseInterest(student.id, parsed.data.courseId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ data: { created: result.created, course: result.course } });
}
