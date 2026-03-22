import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canStaff(roleName?: string): boolean {
  return !!roleName && roleName !== "STUDENT" && roleName !== "ADMIN" && roleName !== "SUB_AGENT" && roleName !== "ADMIN";
}

export async function GET(
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

  const results = await db.courseEligibilityResult.findMany({
    where: { studentId: student.id },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          level: true,
          fieldOfStudy: true,
          tuitionFee: true,
          currency: true,
          university: {
            select: {
              id: true,
              name: true,
              country: true,
            },
          },
        },
      },
    },
    orderBy: [
      { matchScore: "desc" },
      { calculatedAt: "desc" },
    ],
  });

  return NextResponse.json({ data: results });
}
