import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import TrainingRecordsClient from "@/components/TrainingRecordsClient";

export default async function DashboardTrainingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    return <div className="p-6 text-sm text-slate-600">Unauthorized</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Training</h1>
        <p className="text-sm text-slate-600">Track staff training records and upcoming sessions.</p>
      </div>
      <TrainingRecordsClient apiBase="/api/dashboard/training" variant="dashboard" canManage />
    </div>
  );
}
