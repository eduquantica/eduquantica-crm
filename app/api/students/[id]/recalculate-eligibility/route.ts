import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";

function canStaff(roleName?: string): boolean {
  return !!roleName && roleName !== "STUDENT" && roleName !== "ADMIN" && roleName !== "SUB_AGENT" && roleName !== "ADMIN";
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const isOwner = student.userId === session.user.id;
  if (!isOwner && !canStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const recalculated = await EligibilityMatcher.recalculateForStudentShortlisted(student.id);
    return NextResponse.json({
      data: {
        studentId: student.id,
        recalculatedCourses: recalculated.totalCourses,
      },
    });
  } catch (error) {
    console.error("[/api/students/[id]/recalculate-eligibility POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
