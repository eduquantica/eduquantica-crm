import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import StaffTrainingSection from "@/components/StaffTrainingSection";

export default async function DashboardUserProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    return <div className="p-6 text-sm text-slate-600">Unauthorized</div>;
  }

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      role: { select: { name: true, label: true } },
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { id: true } },
    },
  });

  if (!user || user.role.name === "STUDENT" || user.subAgent || user.subAgentStaff) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{user.name || user.email}</h1>
          <p className="text-sm text-slate-600">{user.role.label} • {user.isActive ? "Active" : "Inactive"}</p>
        </div>
        <Link href="/dashboard/settings/users" className="text-sm text-blue-600 hover:underline">Back to staff list</Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700"><span className="font-medium">Email:</span> {user.email}</p>
        <p className="text-sm text-slate-700"><span className="font-medium">Phone:</span> {user.phone || "-"}</p>
      </div>

      <StaffTrainingSection endpoint={`/api/dashboard/users/${params.id}/training`} canManage />
    </div>
  );
}
