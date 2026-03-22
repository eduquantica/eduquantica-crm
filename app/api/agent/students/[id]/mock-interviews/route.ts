import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: { select: { name: true } },
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { id: true, subAgentId: true } },
    },
  });

  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = actor.role.name;
  if (role !== "SUB_AGENT" && role !== "ADMIN" && role !== "COUNSELLOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subAgentId = actor.subAgent?.id || actor.subAgentStaff?.subAgentId || null;
  if (!subAgentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await db.student.findFirst({
    where: {
      id: params.id,
      subAgentId,
    },
    select: { id: true },
  });

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const rows = await db.mockInterview.findMany({
    where: { studentId: student.id },
    include: {
      application: {
        select: {
          id: true,
          course: {
            select: {
              name: true,
              university: { select: { name: true, country: true } },
            },
          },
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
      assignedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return NextResponse.json({ data: rows });
}
