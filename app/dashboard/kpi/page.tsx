import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import KpiManagementClient from "@/components/KpiManagementClient";

export default async function DashboardKpiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "COUNSELLOR")) {
    return <div className="p-6 text-sm text-slate-600">Unauthorized</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">KPI Management</h1>
        <p className="text-sm text-slate-600">Set targets, review team performance, and monitor recruitment outcomes.</p>
      </div>
      <KpiManagementClient variant="dashboard" canEdit={session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER"} />
    </div>
  );
}
