import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CommissionsAdminClient from "./CommissionsAdminClient";

export default async function CommissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    redirect("/dashboard");
  }

  return <CommissionsAdminClient />;
}
