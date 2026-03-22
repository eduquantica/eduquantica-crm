import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";

const allocateSchema = z.object({
  leadId: z.string().min(1),
  allocatedToId: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const bulkAllocateSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1),
  allocatedToId: z.string().min(1),
  notes: z.string().optional().nullable(),
});

async function ensureSubAgentCounsellor(subAgentId: string, userId: string) {
  return db.user.findFirst({
    where: {
      id: userId,
      OR: [
        { subAgent: { id: subAgentId } },
        { subAgentStaff: { subAgentId, isActive: true } },
      ],
    },
    select: { id: true },
  });
}

async function allocateLead(leadId: string, allocatedToId: string, allocatedById: string, notes?: string | null) {
  await db.$transaction(async (tx) => {
    await tx.leadAllocation.updateMany({ where: { leadId, isActive: true }, data: { isActive: false } });
    await tx.leadAllocation.create({
      data: {
        leadId,
        allocatedToId,
        allocatedById,
        notes: notes || null,
        isActive: true,
      },
    });

    await tx.lead.update({ where: { id: leadId }, data: { assignedCounsellorId: allocatedToId } });
  });
}

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (scope.isBranchCounsellor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (Array.isArray(body.leadIds)) {
    const parsedBulk = bulkAllocateSchema.safeParse(body);
    if (!parsedBulk.success) return NextResponse.json({ error: parsedBulk.error.flatten() }, { status: 400 });

    const payload = parsedBulk.data;
    const target = await ensureSubAgentCounsellor(scope.subAgentId, payload.allocatedToId);
    if (!target) return NextResponse.json({ error: "Invalid branch counsellor" }, { status: 400 });

    const leads = await db.lead.findMany({
      where: {
        id: { in: payload.leadIds },
        subAgentId: scope.subAgentId,
      },
      select: { id: true },
    });

    await Promise.all(leads.map((lead) => allocateLead(lead.id, payload.allocatedToId, scope.userId, payload.notes)));

    return NextResponse.json({ ok: true, count: leads.length });
  }

  const parsed = allocateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const target = await ensureSubAgentCounsellor(scope.subAgentId, payload.allocatedToId);
  if (!target) return NextResponse.json({ error: "Invalid branch counsellor" }, { status: 400 });

  const lead = await db.lead.findUnique({ where: { id: payload.leadId }, select: { id: true, subAgentId: true } });
  if (!lead || lead.subAgentId !== scope.subAgentId) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await allocateLead(payload.leadId, payload.allocatedToId, scope.userId, payload.notes);
  return NextResponse.json({ ok: true });
}
