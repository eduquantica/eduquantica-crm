import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  subAgentId: z.string().min(1),
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const roleName = session.user.roleName;
  if (!["ADMIN", "MANAGER", "BRANCH_MANAGER"].includes(roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { subAgentId } = parsed.data;

  const lead = await db.lead.findUnique({ where: { id: params.id }, select: { id: true, subAgentId: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (roleName === "BRANCH_MANAGER") {
    const scope = await resolveScope(session.user.id, roleName);
    if (!scope.subAgentId || scope.subAgentId !== subAgentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const subAgent = await db.subAgent.findUnique({ where: { id: subAgentId }, select: { id: true, agencyName: true } });
  if (!subAgent) return NextResponse.json({ error: "Invalid sub-agent" }, { status: 400 });

  const updatedLead = await db.lead.update({
    where: { id: params.id },
    data: { subAgentId },
    include: { subAgent: { select: { id: true, agencyName: true } } },
  });

  return NextResponse.json({ data: { lead: updatedLead } });
}
