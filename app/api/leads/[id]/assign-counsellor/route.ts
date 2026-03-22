import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  counsellorId: z.string().min(1),
});

async function resolveScope(userId: string, roleName: string) {
  if (roleName === "SUB_AGENT") {
    const owner = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    return { subAgentId: owner?.id ?? null };
  }

  if (roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR") {
    const staff = await db.subAgentStaff.findUnique({ where: { userId }, select: { subAgentId: true } });
    return { subAgentId: staff?.subAgentId ?? null };
  }

  return { subAgentId: null };
}

function canAssign(roleName: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "SUB_AGENT" || roleName === "BRANCH_MANAGER";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const roleName = session.user.roleName;
  if (!canAssign(roleName)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { counsellorId } = parsed.data;

  const lead = await db.lead.findUnique({ where: { id: params.id }, select: { id: true, subAgentId: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (roleName === "ADMIN" || roleName === "MANAGER") {
    const counsellor = await db.user.findFirst({
      where: { id: counsellorId, role: { name: "COUNSELLOR" }, isActive: true },
      select: { id: true },
    });

    if (!counsellor) {
      return NextResponse.json({ error: "Invalid counsellor" }, { status: 400 });
    }

    const updatedLead = await db.lead.update({
      where: { id: params.id },
      data: { assignedCounsellorId: counsellorId },
      include: { assignedCounsellor: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: { lead: updatedLead } });
  }

  const scope = await resolveScope(session.user.id, roleName);
  if (!scope.subAgentId || lead.subAgentId !== scope.subAgentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const agencyCounsellor = await db.subAgentStaff.findFirst({
    where: {
      subAgentId: scope.subAgentId,
      userId: counsellorId,
      isActive: true,
      OR: [
        { role: { contains: "COUNSELLOR", mode: "insensitive" } },
        { user: { role: { name: "SUB_AGENT_COUNSELLOR" } } },
      ],
    },
    select: { userId: true },
  });

  if (!agencyCounsellor) {
    return NextResponse.json({ error: "Invalid counsellor" }, { status: 400 });
  }

  const updatedLead = await db.lead.update({
    where: { id: params.id },
    data: { assignedCounsellorId: counsellorId },
    include: { assignedCounsellor: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: { lead: updatedLead } });
}
