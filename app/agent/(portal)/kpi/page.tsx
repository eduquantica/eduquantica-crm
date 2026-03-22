import { redirect } from "next/navigation";
import { getAgentScope } from "@/lib/agent-scope";
import KpiManagementClient from "@/components/KpiManagementClient";

export default async function AgentKpiPage() {
  const scope = await getAgentScope();
  if (!scope) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">KPI Management</h1>
        <p className="text-sm text-slate-600">Track branch KPI targets and performance by period.</p>
      </div>
      <KpiManagementClient variant="agent" canEdit={!scope.isBranchCounsellor} />
    </div>
  );
}
