import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.roleName ?? "ADMIN";
  return <DashboardClient role={role} />;
}
