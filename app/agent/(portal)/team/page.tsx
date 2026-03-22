import { redirect } from "next/navigation";
import { getAgentScope } from "@/lib/agent-scope";
import AgentTeamClient from "./AgentTeamClient";

export default async function AgentTeamPage() {
  const scope = await getAgentScope();
  if (!scope) {
    redirect("/login");
  }

  if (scope.isBranchCounsellor) {
    redirect("/agent/dashboard");
  }

  return <AgentTeamClient />;
}
