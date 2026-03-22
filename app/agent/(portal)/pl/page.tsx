import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitLossClient from "@/components/pl/ProfitLossClient";

export default async function AgentPLPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["SUB_AGENT", "BRANCH_MANAGER"].includes(session.user.roleName)) {
    redirect("/agent/dashboard");
  }

  return <ProfitLossClient isAdmin={false} />;
}
