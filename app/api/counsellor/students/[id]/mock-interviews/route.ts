import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.roleName;
  const isAdmin = role === "ADMIN" || role === "MANAGER";
  const isCounsellor = role === "COUNSELLOR";

  if (!isAdmin && !isCounsellor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true, assignedCounsellorId: true },
  });

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (isCounsellor && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.mockInterview.findMany({
    where: { studentId: student.id },
    include: {
      application: {
        select: {
          id: true,
          course: { select: { name: true, university: { select: { name: true, country: true } } } },
        },
      },
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
          generatedAt: true,
        },
      },
      assignedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return NextResponse.json({ data: rows });
}
