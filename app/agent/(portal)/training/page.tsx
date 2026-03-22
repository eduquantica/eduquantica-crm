import { redirect } from "next/navigation";
import { getAgentScope } from "@/lib/agent-scope";
import TrainingRecordsClient from "@/components/TrainingRecordsClient";

export default async function AgentTrainingPage() {
  const scope = await getAgentScope();
  if (!scope) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Training</h1>
        <p className="text-sm text-slate-600">Track your organisation training records and renewals.</p>
      </div>
      <TrainingRecordsClient apiBase="/api/agent/training" variant="agent" canManage={!scope.isBranchCounsellor} />
    </div>
  );
}
