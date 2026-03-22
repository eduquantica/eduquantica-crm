import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import LeadsClient from "@/app/dashboard/leads/LeadsClient";

export default async function ManagerLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [counsellors, subAgents] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { name: "COUNSELLOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.subAgent.findMany({
      where: { isApproved: true },
      select: { id: true, agencyName: true },
      orderBy: { agencyName: "asc" },
    }),
  ]);

  return (
    <LeadsClient
      role={session.user.roleName}
      counsellors={counsellors.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
      subAgents={subAgents}
      apiBasePath="/api/leads"
      detailBasePath="/manager/leads"
      addLeadHref="/dashboard/leads/new"
      showImportButton={false}
    />
  );
}
