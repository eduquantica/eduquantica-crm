import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import LeadDetailClient from "@/app/dashboard/leads/[id]/LeadDetailClient";

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

export default async function AgentLeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.roleName;
  if (!["SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(role)) {
    redirect("/agent/leads");
  }

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedCounsellor: {
        select: { id: true, name: true, email: true },
      },
      subAgent: {
        select: { id: true, agencyName: true },
      },
      communications: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!lead) {
    redirect("/agent/leads");
  }

  const subAgentId = await resolveAgentSubAgentId(session.user.id, role);
  if (!subAgentId || lead.subAgentId !== subAgentId) {
    redirect("/agent/leads");
  }

  if (role === "SUB_AGENT_COUNSELLOR" && lead.assignedCounsellorId !== session.user.id) {
    redirect("/agent/leads");
  }

  const [counsellors, branchSubAgents] = await Promise.all([
    role === "SUB_AGENT" || role === "BRANCH_MANAGER"
      ? db.subAgentStaff.findMany({
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
        })
      : Promise.resolve([]),
    role === "BRANCH_MANAGER"
      ? db.subAgent.findMany({ where: { id: subAgentId }, select: { id: true, agencyName: true } })
      : Promise.resolve([]),
  ]);

  const serializedLead = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    communications: lead.communications.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    tasks: lead.tasks.map((t) => ({
      ...t,
      dueDate: t.dueDate?.toISOString() || null,
    })),
  };

  return (
    <LeadDetailClient
      initialLead={serializedLead}
      session={session}
      userRole={role}
      userId={session.user.id}
      backHref="/agent/leads"
      onDeleteRedirectHref="/agent/leads"
      canDeleteLead={false}
      counsellorOptions={counsellors.map((c) => ({ id: c.userId, name: c.name }))}
      subAgentOptions={branchSubAgents}
      allowAssignCounsellor={role === "SUB_AGENT" || role === "BRANCH_MANAGER"}
      allowAssignSubAgent={role === "BRANCH_MANAGER"}
    />
  );
}
