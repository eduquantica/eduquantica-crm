import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SubAgentsClient from "./SubAgentsClient";

export const metadata = {
  title: "Sub-Agents",
};

export default async function SubAgentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    redirect("/dashboard");
  }

  return <SubAgentsClient viewerRole={session.user.roleName} />;
}
