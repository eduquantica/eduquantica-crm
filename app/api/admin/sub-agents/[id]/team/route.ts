import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { id: params.id },
    select: { id: true, agencyName: true },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const [team, unassignedStudents] = await Promise.all([
    db.subAgentStaff.findMany({
      where: { subAgentId: params.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        studentsCount: true,
        createdAt: true,
      },
    }),
    db.student.count({
      where: {
        subAgentId: params.id,
        subAgentStaffId: null,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      agencyName: subAgent.agencyName,
      team,
      unassignedStudents,
    },
  });
}
