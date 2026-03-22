import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope } from "@/lib/agent-scope";
import { IN_PROGRESS_STATUSES } from "@/lib/agent-dashboard";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (scope.isBranchCounsellor && scope.subAgentStaffId) {
    const [studentsCount, activeApplications, enrolledThisYear, self] = await Promise.all([
      db.student.count({ where: { subAgentId: scope.subAgentId, subAgentStaffId: scope.subAgentStaffId } }),
      db.application.count({
        where: {
          student: { subAgentId: scope.subAgentId, subAgentStaffId: scope.subAgentStaffId },
          status: { in: IN_PROGRESS_STATUSES },
        },
      }),
      db.application.count({
        where: {
          student: { subAgentId: scope.subAgentId, subAgentStaffId: scope.subAgentStaffId },
          status: "ENROLLED",
          enrolledAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
      }),
      db.subAgentStaff.findUnique({
        where: { id: scope.subAgentStaffId },
        select: { name: true, email: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        teamSize: 1,
        unassignedStudents: 0,
        counsellors: [
          {
            id: scope.subAgentStaffId,
            name: self?.name || "Branch Counsellor",
            email: self?.email || "",
            role: "Branch Counsellor",
            studentsCount,
            activeApplications,
            enrolledThisYear,
            conversionRate: studentsCount > 0 ? Number(((enrolledThisYear / studentsCount) * 100).toFixed(1)) : 0,
            isActive: true,
          },
        ],
      },
    });
  }

  const staff = await db.subAgentStaff.findMany({
    where: { subAgentId: scope.subAgentId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      studentsCount: true,
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  const staffIds = staff.map((item) => item.id);

  const [studentCounts, inProgressCounts, enrolledCounts, unassignedStudents] = await Promise.all([
    db.student.groupBy({
      by: ["subAgentStaffId"],
      where: {
        subAgentId: scope.subAgentId,
        subAgentStaffId: { in: staffIds.length ? staffIds : ["none"] },
      },
      _count: { _all: true },
    }),
    db.application.groupBy({
      by: ["subAgentStaffId"],
      where: {
        student: { subAgentId: scope.subAgentId },
        subAgentStaffId: { in: staffIds.length ? staffIds : ["none"] },
        status: { in: IN_PROGRESS_STATUSES },
      },
      _count: { _all: true },
    }),
    db.application.groupBy({
      by: ["subAgentStaffId"],
      where: {
        student: { subAgentId: scope.subAgentId },
        subAgentStaffId: { in: staffIds.length ? staffIds : ["none"] },
        status: "ENROLLED",
        enrolledAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
      _count: { _all: true },
    }),
    db.student.count({
      where: {
        subAgentId: scope.subAgentId,
        subAgentStaffId: null,
      },
    }),
  ]);

  const studentsByStaff = new Map(studentCounts.map((row) => [row.subAgentStaffId || "", row._count._all]));
  const inProgressByStaff = new Map(inProgressCounts.map((row) => [row.subAgentStaffId || "", row._count._all]));
  const enrolledByStaff = new Map(enrolledCounts.map((row) => [row.subAgentStaffId || "", row._count._all]));

  const counsellors = staff.map((item) => {
    const studentsCount = studentsByStaff.get(item.id) || item.studentsCount || 0;
    const activeApplications = inProgressByStaff.get(item.id) || 0;
    const enrolledThisYear = enrolledByStaff.get(item.id) || 0;
    return {
      id: item.id,
      name: item.name || item.user.name || "Branch Counsellor",
      email: item.email || item.user.email || "",
      role: item.role === "BRANCH_COUNSELLOR" ? "Branch Counsellor" : item.role,
      studentsCount,
      activeApplications,
      enrolledThisYear,
      conversionRate: studentsCount > 0 ? Number(((enrolledThisYear / studentsCount) * 100).toFixed(1)) : 0,
      isActive: item.isActive,
    };
  });

  return NextResponse.json({
    data: {
      teamSize: counsellors.length,
      unassignedStudents,
      counsellors,
    },
  });
}
