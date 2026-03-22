import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setStatus"),
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal("reassignStudent"),
    studentId: z.string().min(1),
    subAgentStaffId: z.string().nullable(),
  }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; staffId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = patchSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  if (payload.data.action === "reassignStudent") {
    const targetStudentId = payload.data.studentId;
    const targetSubAgentStaffId = payload.data.subAgentStaffId;

    const student = await db.student.findFirst({
      where: {
        id: targetStudentId,
        subAgentId: params.id,
      },
      select: { id: true, subAgentStaffId: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (targetSubAgentStaffId) {
      if (targetSubAgentStaffId !== params.staffId) {
        return NextResponse.json({ error: "Path staffId must match target reassignment staff" }, { status: 400 });
      }

      const staff = await db.subAgentStaff.findFirst({
        where: {
          id: targetSubAgentStaffId,
          subAgentId: params.id,
          isActive: true,
        },
        select: { id: true },
      });
      if (!staff) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: targetStudentId },
        data: { subAgentStaffId: targetSubAgentStaffId || null },
      });

      await tx.application.updateMany({
        where: { studentId: targetStudentId },
        data: { subAgentStaffId: targetSubAgentStaffId || null },
      });

      if (student.subAgentStaffId) {
        const previousCount = await tx.student.count({
          where: {
            subAgentId: params.id,
            subAgentStaffId: student.subAgentStaffId,
          },
        });

        await tx.subAgentStaff.update({
          where: { id: student.subAgentStaffId },
          data: { studentsCount: previousCount },
        });
      }

      if (targetSubAgentStaffId) {
        const nextCount = await tx.student.count({
          where: {
            subAgentId: params.id,
            subAgentStaffId: targetSubAgentStaffId,
          },
        });

        await tx.subAgentStaff.update({
          where: { id: targetSubAgentStaffId },
          data: { studentsCount: nextCount },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "student",
          entityId: targetStudentId,
          action: "sub_agent_staff_reassigned",
          details: `Student reassigned to branch counsellor ${targetSubAgentStaffId || "none"}`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  const staff = await db.subAgentStaff.findFirst({
    where: {
      id: params.staffId,
      subAgentId: params.id,
    },
    select: { id: true, name: true },
  });

  if (!staff) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const updated = await db.subAgentStaff.update({
    where: { id: staff.id },
    data: {
      isActive: payload.data.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      studentsCount: true,
      createdAt: true,
    },
  });

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "sub_agent_staff",
      entityId: staff.id,
      action: "sub_agent_staff_admin_updated",
      details: `Admin updated branch counsellor ${staff.name}`,
    },
  });

  return NextResponse.json({ data: updated });
}
