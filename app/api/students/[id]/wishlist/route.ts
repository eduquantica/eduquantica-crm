import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const STAFF_ROLES = ["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"];

function isStaff(roleName?: string | null): boolean {
  return !!roleName && STAFF_ROLES.includes(roleName);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const items = await db.studentWishlist.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    select: {
      courseId: true,
      createdAt: true,
      course: {
        select: {
          id: true,
          name: true,
          level: true,
          tuitionFee: true,
          currency: true,
          university: {
            select: { id: true, name: true, country: true },
          },
        },
      },
    },
  });

  const data = items.map((item) => ({
    courseId: item.courseId,
    courseName: item.course.name,
    courseLevel: item.course.level,
    universityId: item.course.university.id,
    universityName: item.course.university.name,
    universityCountry: item.course.university.country,
    tuitionFee: item.course.tuitionFee,
    currency: item.course.currency,
    addedAt: item.createdAt.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  let courseId: string;
  try {
    const body = await req.json() as { courseId?: unknown };
    if (typeof body.courseId !== "string" || !body.courseId.trim()) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }
    courseId = body.courseId.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, isActive: true },
  });
  if (!course || !course.isActive) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  await db.studentWishlist.upsert({
    where: { studentId_courseId: { studentId: student.id, courseId } },
    update: {},
    create: { studentId: student.id, courseId },
  });

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
