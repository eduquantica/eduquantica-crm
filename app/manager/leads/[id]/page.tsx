import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import LeadDetailClient from "@/app/dashboard/leads/[id]/LeadDetailClient";

export default async function ManagerLeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
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
    redirect("/manager/leads");
  }

  const counsellors = await db.user.findMany({
    where: { role: { name: "COUNSELLOR" }, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const subAgents = await db.subAgent.findMany({
    where: { isApproved: true },
    select: { id: true, agencyName: true },
    orderBy: { agencyName: "asc" },
  });

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
      userRole={session.user.roleName}
      userId={session.user.id}
      backHref="/manager/leads"
      onDeleteRedirectHref="/manager/leads"
      canDeleteLead={lead.assignedCounsellorId === null}
      counsellorOptions={counsellors.map((c) => ({ id: c.id, name: c.name ?? c.email }))}
      subAgentOptions={subAgents}
      allowAssignCounsellor
      allowAssignSubAgent
      deleteEndpointBase="/api/admin/leads"
    />
  );
}
