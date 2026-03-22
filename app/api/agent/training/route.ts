import { NextRequest, NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  deriveTrainingStatus,
  getSubAgentStaffOptions,
  normaliseTrainingStatus,
  toSubAgentOrgType,
} from "@/lib/training";

const createSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  deliveredBy: z.string().optional().nullable(),
  trainingDate: z.string().optional().nullable(),
  completionDate: z.string().min(1),
  expiryDate: z.string().optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringMonths: z.number().int().min(1).max(36).optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const staffId = searchParams.get("staffId") || "";
  const trainingName = searchParams.get("trainingName") || "";
  const statusRaw = searchParams.get("status") || "";
  const roleRaw = searchParams.get("role") || "";

  const status = normaliseTrainingStatus(statusRaw);

  const orgType = toSubAgentOrgType(scope.subAgentId);

  const records = await db.trainingRecord.findMany({
    where: {
      training: {
        organisationType: orgType,
      },
      ...(staffId ? { userId: staffId } : {}),
      ...(trainingName
        ? {
            training: {
              organisationType: orgType,
              name: { contains: trainingName, mode: "insensitive" as const },
            },
          }
        : {}),
      ...(status ? { status } : {}),
      ...(roleRaw ? { user: { role: { name: roleRaw } } } : {}),
      ...(scope.isBranchCounsellor && scope.subAgentStaffId
        ? { userId: scope.userId }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { name: true, label: true } },
        },
      },
      training: {
        select: {
          id: true,
          organisationType: true,
          name: true,
          description: true,
          deliveredBy: true,
          trainingDate: true,
          isRecurring: true,
          recurringMonths: true,
        },
      },
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
  });

  const staffOptions = await getSubAgentStaffOptions(scope.subAgentId);

  return NextResponse.json({
    data: {
      records: records.map((row) => ({
        id: row.id,
        trainingId: row.trainingId,
        userId: row.userId,
        staffName: row.user.name || row.user.email,
        staffRole: row.user.role.label,
        staffRoleName: row.user.role.name,
        trainingName: row.training.name,
        description: row.training.description,
        deliveredBy: row.training.deliveredBy,
        trainingDate: row.training.trainingDate,
        completionDate: row.completionDate,
        expiryDate: row.expiryDate,
        status: row.status,
        certificateUrl: row.certificateUrl,
        notes: row.notes,
        isRecurring: row.training.isRecurring,
        recurringMonths: row.training.recurringMonths,
      })),
      staffOptions,
    },
  });
}

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (scope.isBranchCounsellor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { subAgentId: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Staff user not found" }, { status: 404 });

  const belongsToSubAgent = user.subAgent?.id === scope.subAgentId || user.subAgentStaff?.subAgentId === scope.subAgentId;
  if (!belongsToSubAgent) {
    return NextResponse.json({ error: "Staff user does not belong to your organisation" }, { status: 400 });
  }

  const completionDate = new Date(payload.completionDate);
  const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null;

  if (Number.isNaN(completionDate.getTime())) {
    return NextResponse.json({ error: "Invalid completion date" }, { status: 400 });
  }

  const status = deriveTrainingStatus(expiryDate);

  const created = await db.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        organisationId: scope.subAgentId,
        organisationType: toSubAgentOrgType(scope.subAgentId),
        name: payload.name,
        description: payload.description || null,
        deliveredBy: payload.deliveredBy || null,
        trainingDate: payload.trainingDate ? new Date(payload.trainingDate) : null,
        expiryDate,
        isRecurring: payload.isRecurring,
        recurringMonths: payload.isRecurring ? payload.recurringMonths || null : null,
        createdBy: scope.userId,
      },
    });

    const record = await tx.trainingRecord.create({
      data: {
        trainingId: training.id,
        userId: payload.userId,
        completionDate,
        expiryDate,
        certificateUrl: payload.certificateUrl || null,
        notes: payload.notes || null,
        status,
      },
    });

    return { training, record };
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}
