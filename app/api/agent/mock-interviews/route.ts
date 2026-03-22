import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.roleName;
  if (role !== "SUB_AGENT" && role !== "ADMIN" && role !== "COUNSELLOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { subAgentId: true } },
    },
  });

  const subAgentId = actor?.subAgent?.id || actor?.subAgentStaff?.subAgentId;
  if (!subAgentId) return NextResponse.json({ data: [] });

  const rows = await db.mockInterview.findMany({
    where: {
      student: {
        subAgentId,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          subAgentStaffId: true,
        },
      },
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
