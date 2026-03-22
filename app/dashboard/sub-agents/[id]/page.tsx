import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SubAgentProfileClient from "./SubAgentProfileClient";

export default async function SubAgentProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    redirect("/dashboard");
  }

  return <SubAgentProfileClient id={params.id} />;
}
