import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitLossClient from "@/components/pl/ProfitLossClient";

export default async function AdminPLPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    redirect("/dashboard");
  }

  return <ProfitLossClient isAdmin />;
}
