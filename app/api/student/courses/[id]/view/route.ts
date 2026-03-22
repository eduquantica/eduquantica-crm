import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, recentlyViewedCourses: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const course = await db.course.findUnique({
    where: { id: params.id },
    select: { id: true, isActive: true },
  });

  if (!course || !course.isActive) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const previous = Array.isArray(student.recentlyViewedCourses)
    ? student.recentlyViewedCourses.map((item) => String(item))
    : [];

  const next = [course.id, ...previous.filter((id) => id !== course.id)].slice(0, 10);

  await db.student.update({
    where: { id: student.id },
    data: {
      recentlyViewedCourses: next,
    },
  });

  return NextResponse.json({ data: { tracked: true } });
}
