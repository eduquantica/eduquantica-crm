import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AgentDashboardClient from "./AgentDashboardClient";

export default async function AgentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT") {
    redirect("/login");
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
  });

  if (!subAgent || !subAgent.isApproved) {
    redirect("/agent/pending");
  }

  return <AgentDashboardClient />;
}
