import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const roleName = session.user.roleName;
  const userId = session.user.id;

  if (roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR") {
    const [counsellors, subAgents] = await Promise.all([
      db.user.findMany({
        where: { isActive: true, role: { name: "COUNSELLOR" } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      db.subAgent.findMany({
        where: { isApproved: true },
        select: { id: true, agencyName: true },
        orderBy: { agencyName: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: {
        counsellors: counsellors.map((c) => ({ id: c.id, name: c.name ?? c.email })),
        subAgents,
      },
    });
  }

  if (roleName === "SUB_AGENT" || roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR") {
    const scope = await resolveScope(userId, roleName);
    if (!scope.subAgentId) {
      return NextResponse.json({ data: { counsellors: [], subAgents: [] } });
    }

    const [counsellors, subAgent] = await Promise.all([
      db.subAgentStaff.findMany({
        where: {
          subAgentId: scope.subAgentId,
          isActive: true,
          OR: [
            { role: { contains: "COUNSELLOR", mode: "insensitive" } },
            { user: { role: { name: "SUB_AGENT_COUNSELLOR" } } },
          ],
        },
        select: { userId: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.subAgent.findUnique({ where: { id: scope.subAgentId }, select: { id: true, agencyName: true } }),
    ]);

    return NextResponse.json({
      data: {
        counsellors: counsellors.map((c) => ({ id: c.userId, name: c.name })),
        subAgents: subAgent ? [{ id: subAgent.id, agencyName: subAgent.agencyName }] : [],
      },
    });
  }

  return NextResponse.json({ data: { counsellors: [], subAgents: [] } });
}
