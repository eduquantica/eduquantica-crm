import { redirect } from "next/navigation";
import { getAgentScope } from "@/lib/agent-scope";
import AgentCertificateClient from "./AgentCertificateClient";

export default async function AgentCertificatePage() {
  const scope = await getAgentScope();
  if (!scope) {
    redirect("/login");
  }

  return <AgentCertificateClient />;
}
