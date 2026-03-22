import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.roleName ?? "ADMIN";

  // Pre-fetch dropdown options server-side (static across the page lifetime)
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
      role={role}
      counsellors={counsellors.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
      subAgents={subAgents}
      apiBasePath="/api/leads"
      detailBasePath="/dashboard/leads"
      addLeadHref="/dashboard/leads/new"
      showImportButton={role === "ADMIN" || role === "MANAGER"}
    />
  );
}
