import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAgentScope } from "@/lib/agent-scope";

const assignSchema = z.object({
  staffId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (scope.isBranchCounsellor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = assignSchema.parse(await req.json());

    const staff = await db.subAgentStaff.findFirst({
      where: {
        id: payload.staffId,
        subAgentId: scope.subAgentId,
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const scopedStudents = await db.student.findMany({
      where: {
        id: { in: payload.studentIds },
        subAgentId: scope.subAgentId,
      },
      select: { id: true },
    });

    const validStudentIds = scopedStudents.map((row) => row.id);
    if (validStudentIds.length === 0) {
      return NextResponse.json({ error: "No valid students found for assignment" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      await tx.student.updateMany({
        where: { id: { in: validStudentIds } },
        data: { subAgentStaffId: staff.id },
      });

      await tx.application.updateMany({
        where: { studentId: { in: validStudentIds } },
        data: { subAgentStaffId: staff.id },
      });

      const staffStudentsCount = await tx.student.count({
        where: {
          subAgentId: scope.subAgentId,
          subAgentStaffId: staff.id,
        },
      });

      await tx.subAgentStaff.update({
        where: { id: staff.id },
        data: { studentsCount: staffStudentsCount },
      });

      await tx.activityLog.create({
        data: {
          userId: scope.userId,
          entityType: "sub_agent_staff",
          entityId: staff.id,
          action: "students_assigned_to_branch_counsellor",
          details: `Assigned ${validStudentIds.length} students to ${staff.name}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: staff.userId,
          type: "STUDENTS_ASSIGNED",
          message: `${validStudentIds.length} student(s) were assigned to you.`,
          linkUrl: "/agent/students",
        },
      });
    });

    return NextResponse.json({ data: { assignedCount: validStudentIds.length } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("[api/agent/team/assign-students POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
