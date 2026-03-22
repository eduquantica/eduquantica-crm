import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility/checkEligibility";
import { statusScore, toMatchStatus } from "@/lib/eligibility/presentation";

function canStaff(roleName?: string): boolean {
  return !!roleName && roleName !== "STUDENT" && roleName !== "ADMIN" && roleName !== "SUB_AGENT" && roleName !== "ADMIN";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "studentId query parameter is required" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
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
    const eligibility = await checkEligibility(student.id, params.id);
    return NextResponse.json({
      data: {
        ...eligibility,
        matchStatus: toMatchStatus(eligibility),
        matchScore: statusScore(eligibility),
      },
    });
  } catch (error) {
    console.error("[/api/courses/[id]/eligibility GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
