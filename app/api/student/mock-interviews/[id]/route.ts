import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const interview = await db.mockInterview.findFirst({
    where: {
      id: params.id,
      studentId: student.id,
    },
    include: {
      application: {
        select: {
          id: true,
          course: { select: { name: true, university: { select: { name: true, country: true } } } },
        },
      },
      rounds: {
        include: {
          exchanges: {
            orderBy: { questionNumber: "asc" },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
      report: true,
    },
  });

  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

  return NextResponse.json({ data: interview });
}
