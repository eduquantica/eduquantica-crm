import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";
import { statusToPipelineStage } from "@/lib/agent-dashboard";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentWhere = getAgentStudentWhere(scope);

  const rows = await db.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationality: true,
      createdAt: true,
      assignedCounsellor: {
        select: { name: true },
      },
      subAgentStaff: {
        select: { name: true },
      },
      applications: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          status: true,
          createdAt: true,
          course: {
            select: {
              name: true,
              university: { select: { name: true } },
            },
          },
        },
      },
    },
    take: 50,
  });

  const ordered = rows
    .map((student) => {
      const latestApplication = student.applications[0] || null;
      const lastUpdatedAt = latestApplication?.createdAt || student.createdAt;
      return {
        id: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        nationality: student.nationality,
        courseName: latestApplication?.course.name || "-",
        universityName: latestApplication?.course.university.name || "-",
        applicationStatus: latestApplication?.status || "APPLIED",
        pipelineStage: statusToPipelineStage(latestApplication?.status || "APPLIED"),
        assignedCounsellorName: student.assignedCounsellor?.name || "-",
        branchCounsellorName: student.subAgentStaff?.name || "-",
        lastUpdatedAt,
        href: `/agent/students/${student.id}`,
      };
    })
    .sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime())
    .slice(0, 10)
    .map((row) => ({
      ...row,
      lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    }));

  return NextResponse.json({ data: ordered });
}
