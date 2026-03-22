import { NextRequest, NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";
import { deriveTrainingStatus, toSubAgentOrgType } from "@/lib/training";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  completionDate: z.string().min(1),
  expiryDate: z.string().optional().nullable(),
  deliveredBy: z.string().optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { subAgentId: true } },
    },
  });

  const belongs = targetUser && (targetUser.subAgent?.id === scope.subAgentId || targetUser.subAgentStaff?.subAgentId === scope.subAgentId);
  if (!belongs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const records = await db.trainingRecord.findMany({
    where: {
      userId: params.id,
      training: { organisationType: toSubAgentOrgType(scope.subAgentId) },
    },
    include: { training: true },
    orderBy: [{ expiryDate: "asc" }, { completionDate: "desc" }],
  });

  return NextResponse.json({ data: records });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (scope.isBranchCounsellor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { subAgentId: true } },
    },
  });

  const belongs = targetUser && (targetUser.subAgent?.id === scope.subAgentId || targetUser.subAgentStaff?.subAgentId === scope.subAgentId);
  if (!belongs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = parsed.data;
  const completionDate = new Date(payload.completionDate);
  const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null;

  if (Number.isNaN(completionDate.getTime())) {
    return NextResponse.json({ error: "Invalid completion date" }, { status: 400 });
  }

  const created = await db.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        organisationId: scope.subAgentId,
        organisationType: toSubAgentOrgType(scope.subAgentId),
        name: payload.name,
        deliveredBy: payload.deliveredBy || null,
        expiryDate,
        createdBy: scope.userId,
      },
    });

    return tx.trainingRecord.create({
      data: {
        trainingId: training.id,
        userId: params.id,
        completionDate,
        expiryDate,
        certificateUrl: payload.certificateUrl || null,
        notes: payload.notes || null,
        status: deriveTrainingStatus(expiryDate),
      },
      include: { training: true },
    });
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}
