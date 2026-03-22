import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import LeadDetailClient from "./LeadDetailClient";

export default async function LeadDetailPage({
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
    redirect("/dashboard/leads");
  }

  // Convert Dates to strings for client component
  const serializedLead = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    communications: lead.communications.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    tasks: lead.tasks.map(t => ({
      ...t,
      dueDate: t.dueDate?.toISOString() || null,
    })),
  };

  // For counsellors, check they own the lead
  if (session.user.roleName === "COUNSELLOR") {
    if (lead.assignedCounsellorId !== session.user.id) {
      redirect("/dashboard/leads");
    }
  }

  const [counsellors, subAgents] = await Promise.all([
    session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER"
      ? db.user.findMany({
          where: { role: { name: "COUNSELLOR" }, isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER"
      ? db.subAgent.findMany({
          where: { isApproved: true },
          select: { id: true, agencyName: true },
          orderBy: { agencyName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <LeadDetailClient
      initialLead={serializedLead}
      session={session}
      userRole={session.user.roleName}
      userId={session.user.id}
      canDeleteLead={
        session.user.roleName === "ADMIN"
          || (session.user.roleName === "MANAGER" && !lead.assignedCounsellorId)
      }
      counsellorOptions={counsellors.map((c) => ({ id: c.id, name: c.name || c.email }))}
      subAgentOptions={subAgents}
      allowAssignCounsellor={session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER"}
      allowAssignSubAgent={session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER"}
      deleteEndpointBase={session.user.roleName === "MANAGER" ? "/api/admin/leads" : "/api/leads"}
    />
  );
}
