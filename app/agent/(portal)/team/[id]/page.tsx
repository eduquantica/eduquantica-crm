import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";
import StaffTrainingSection from "@/components/StaffTrainingSection";

export default async function AgentTeamMemberProfilePage({ params }: { params: { id: string } }) {
  const scope = await getAgentScope();
  if (!scope) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subAgent: { select: { id: true } },
    },
  });

  const belongsToScope = user && user.subAgent?.id === scope.subAgentId;
  if (!belongsToScope) {
    notFound();
  }

  if (scope.isBranchCounsellor && params.id !== scope.userId) {
    redirect("/agent/training");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{user.name || user.email}</h1>
          <p className="text-sm text-slate-600">Sub-Agent Owner</p>
        </div>
        <Link href="/agent/team" className="text-sm text-blue-600 hover:underline">Back to team</Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700"><span className="font-medium">Email:</span> {user.email}</p>
        <p className="text-sm text-slate-700"><span className="font-medium">Phone:</span> {user.phone || "-"}</p>
      </div>

      <StaffTrainingSection endpoint={`/api/agent/team/${params.id}/training`} canManage={!scope.isBranchCounsellor} />
    </div>
  );
}
