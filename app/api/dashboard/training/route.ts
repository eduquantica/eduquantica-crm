import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  deriveTrainingStatus,
  EDUQUANTICA_ORG_ID,
  EDUQUANTICA_ORG_TYPE,
  getEduquanticaStaffOptions,
  normaliseTrainingStatus,
} from "@/lib/training";

function ensureTrainingViewer(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

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
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const scope = searchParams.get("scope") === "all" ? "all" : "edu";
  const staffId = searchParams.get("staffId") || "";
  const trainingName = searchParams.get("trainingName") || "";
  const statusRaw = searchParams.get("status") || "";
  const roleRaw = searchParams.get("role") || "";
  const organisation = searchParams.get("organisation") || "";
  const expiryFrom = searchParams.get("expiryFrom") || "";
  const expiryTo = searchParams.get("expiryTo") || "";

  const status = normaliseTrainingStatus(statusRaw);

  const where = {
    ...(scope === "all" ? {} : { training: { organisationType: EDUQUANTICA_ORG_TYPE } }),
    ...(staffId ? { userId: staffId } : {}),
    ...(trainingName
      ? {
          training: {
            ...(scope === "all" ? {} : { organisationType: EDUQUANTICA_ORG_TYPE }),
            name: { contains: trainingName, mode: "insensitive" as const },
          },
        }
      : {}),
    ...(status ? { status } : {}),
    ...(roleRaw ? { user: { role: { name: roleRaw } } } : {}),
    ...(organisation
      ? {
          training: {
            ...(scope === "all" ? {} : { organisationType: EDUQUANTICA_ORG_TYPE }),
            organisationType: organisation,
          },
        }
      : {}),
    ...(expiryFrom || expiryTo
      ? {
          expiryDate: {
            ...(expiryFrom ? { gte: new Date(expiryFrom) } : {}),
            ...(expiryTo ? { lte: new Date(expiryTo) } : {}),
          },
        }
      : {}),
  };

  const records = await db.trainingRecord.findMany({
    where,
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
          organisationId: true,
          organisationType: true,
          name: true,
          description: true,
          deliveredBy: true,
          trainingDate: true,
          expiryDate: true,
          isRecurring: true,
          recurringMonths: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
  });

  const allOrgTypes = Array.from(new Set(records.map((row) => row.training.organisationType)));
  const subAgentIds = allOrgTypes
    .filter((item) => item.startsWith("SUBAGENT_"))
    .map((item) => item.replace("SUBAGENT_", ""));

  const subAgents = subAgentIds.length
    ? await db.subAgent.findMany({
        where: { id: { in: subAgentIds } },
        select: { id: true, agencyName: true },
      })
    : [];

  const subAgentMap = new Map(subAgents.map((item) => [item.id, item.agencyName]));

  const staffOptions = await getEduquanticaStaffOptions();

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
        organisationType: row.training.organisationType,
        organisationLabel:
          row.training.organisationType === EDUQUANTICA_ORG_TYPE
            ? "EduQuantica"
            : subAgentMap.get(row.training.organisationType.replace("SUBAGENT_", "")) || row.training.organisationType,
      })),
      staffOptions,
      organisationOptions: [
        { value: EDUQUANTICA_ORG_TYPE, label: "EduQuantica" },
        ...subAgents.map((row) => ({ value: `SUBAGENT_${row.id}`, label: row.agencyName })),
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: { select: { name: true } },
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { id: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
  if (user.role.name === "STUDENT" || user.role.name === "SUB_AGENT" || user.subAgent || user.subAgentStaff) {
    return NextResponse.json({ error: "Only EduQuantica staff can be added from this page" }, { status: 400 });
  }

  const completionDate = new Date(payload.completionDate);
  const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null;

  if (Number.isNaN(completionDate.getTime())) {
    return NextResponse.json({ error: "Invalid completion date" }, { status: 400 });
  }
  if (expiryDate && Number.isNaN(expiryDate.getTime())) {
    return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
  }

  const status = deriveTrainingStatus(expiryDate);

  const created = await db.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        organisationId: EDUQUANTICA_ORG_ID,
        organisationType: EDUQUANTICA_ORG_TYPE,
        name: payload.name,
        description: payload.description || null,
        deliveredBy: payload.deliveredBy || null,
        trainingDate: payload.trainingDate ? new Date(payload.trainingDate) : null,
        expiryDate,
        isRecurring: payload.isRecurring,
        recurringMonths: payload.isRecurring ? payload.recurringMonths || null : null,
        createdBy: session.user.id,
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
