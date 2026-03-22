import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import LeadsClient from "@/app/dashboard/leads/LeadsClient";

async function resolveAgentSubAgentId(userId: string, roleName: string) {
  if (roleName === "SUB_AGENT") {
    const owner = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    return owner?.id ?? null;
  }

  if (roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR") {
    const staff = await db.subAgentStaff.findUnique({ where: { userId }, select: { subAgentId: true } });
    return staff?.subAgentId ?? null;
  }

  return null;
}

export default async function AgentLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = session.user.roleName;
  if (!["SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(role)) {
    redirect("/agent/dashboard");
  }

  const subAgentId = await resolveAgentSubAgentId(session.user.id, role);

  const [counsellors, subAgents] = subAgentId
    ? await Promise.all([
        db.subAgentStaff.findMany({
          where: {
            subAgentId,
            isActive: true,
            OR: [
              { role: { contains: "COUNSELLOR", mode: "insensitive" } },
              { user: { role: { name: "SUB_AGENT_COUNSELLOR" } } },
            ],
          },
          select: { userId: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.subAgent.findMany({
          where: { id: subAgentId },
          select: { id: true, agencyName: true },
        }),
      ])
    : [[], []];

  return (
    <LeadsClient
      role={role}
      counsellors={counsellors.map((c) => ({ id: c.userId, name: c.name }))}
      subAgents={subAgents}
      apiBasePath="/api/leads"
      detailBasePath="/agent/leads"
      addLeadHref="/agent/leads/new"
      showImportButton={false}
    />
  );
}
