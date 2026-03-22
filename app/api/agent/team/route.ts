import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAgentScope } from "@/lib/agent-scope";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().optional(),
});

const updateSchema = z.object({
  staffId: z.string().min(1),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

const deleteSchema = z.object({
  staffId: z.string().min(1),
});

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (scope.isBranchCounsellor && scope.subAgentStaffId) {
    const self = await db.subAgentStaff.findFirst({
      where: {
        id: scope.subAgentStaffId,
        subAgentId: scope.subAgentId,
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
        userId: true,
      },
    });

    return NextResponse.json({
      data: {
        canManage: false,
        team: self ? [self] : [],
        unassignedStudents: 0,
      },
    });
  }

  const [team, unassignedStudents] = await Promise.all([
    db.subAgentStaff.findMany({
      where: { subAgentId: scope.subAgentId },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        studentsCount: true,
        createdAt: true,
        userId: true,
      },
    }),
    db.student.count({
      where: {
        subAgentId: scope.subAgentId,
        subAgentStaffId: null,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      canManage: true,
      team,
      unassignedStudents,
    },
  });
}

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.isBranchCounsellor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = createSchema.parse(await req.json());

    const existingUser = await db.user.findFirst({
      where: { email: { equals: payload.email.toLowerCase(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const subAgentRole = await db.role.findUnique({
      where: { name: "SUB_AGENT" },
      select: { id: true },
    });
    if (!subAgentRole) {
      return NextResponse.json({ error: "SUB_AGENT role not found" }, { status: 500 });
    }

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: payload.email.toLowerCase(),
          name: payload.name,
          phone: payload.phone || null,
          roleId: subAgentRole.id,
          isActive: true,
        },
      });

      const staff = await tx.subAgentStaff.create({
        data: {
          subAgentId: scope.subAgentId,
          userId: user.id,
          name: payload.name,
          email: payload.email.toLowerCase(),
          phone: payload.phone || null,
          role: payload.role || "BRANCH_COUNSELLOR",
          isActive: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: scope.userId,
          entityType: "sub_agent_staff",
          entityId: staff.id,
          action: "sub_agent_staff_created",
          details: `Created branch counsellor ${staff.name}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: "TEAM_ACCESS_GRANTED",
          message: "You have been added as a branch counsellor in your sub-agent team.",
          linkUrl: "/agent/dashboard",
        },
      });

      return staff;
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("[api/agent/team POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.isBranchCounsellor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = updateSchema.parse(await req.json());

    const staff = await db.subAgentStaff.findFirst({
      where: {
        id: payload.staffId,
        subAgentId: scope.subAgentId,
      },
      select: { id: true, userId: true, name: true },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const updated = await db.$transaction(async (tx) => {
      const staffUpdate = await tx.subAgentStaff.update({
        where: { id: payload.staffId },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.email !== undefined ? { email: payload.email.toLowerCase() } : {}),
          ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
          ...(payload.role !== undefined ? { role: payload.role } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        },
      });

      await tx.user.update({
        where: { id: staff.userId },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.email !== undefined ? { email: payload.email.toLowerCase() } : {}),
          ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: scope.userId,
          entityType: "sub_agent_staff",
          entityId: staff.id,
          action: "sub_agent_staff_updated",
          details: `Updated branch counsellor ${staff.name}`,
        },
      });

      return staffUpdate;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("[api/agent/team PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.isBranchCounsellor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = deleteSchema.parse(await req.json());

    const staff = await db.subAgentStaff.findFirst({
      where: {
        id: payload.staffId,
        subAgentId: scope.subAgentId,
      },
      select: { id: true, userId: true, name: true },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.student.updateMany({
        where: { subAgentId: scope.subAgentId, subAgentStaffId: staff.id },
        data: { subAgentStaffId: null },
      });

      await tx.application.updateMany({
        where: { subAgentStaffId: staff.id },
        data: { subAgentStaffId: null },
      });

      await tx.subAgentStaff.delete({ where: { id: staff.id } });
      await tx.user.update({ where: { id: staff.userId }, data: { isActive: false } });

      await tx.activityLog.create({
        data: {
          userId: scope.userId,
          entityType: "sub_agent_staff",
          entityId: staff.id,
          action: "sub_agent_staff_deleted",
          details: `Removed branch counsellor ${staff.name}`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("[api/agent/team DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
