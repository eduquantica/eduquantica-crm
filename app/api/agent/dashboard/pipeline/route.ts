import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_TO_STATUSES } from "@/lib/agent-dashboard";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentWhere = getAgentStudentWhere(scope);

  const grouped = await db.application.groupBy({
    by: ["status"],
    where: {
      student: studentWhere,
    },
    _count: { _all: true },
  });

  const byStatus = new Map(grouped.map((row) => [row.status, row._count._all]));

  const stages = Object.entries(PIPELINE_STAGE_TO_STATUSES).map(([stage, statuses]) => ({
    key: stage,
    label: PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS],
    statuses,
    count: statuses.reduce((sum, status) => sum + (byStatus.get(status) || 0), 0),
    href: `/agent/applications?stage=${encodeURIComponent(stage)}`,
  }));

  return NextResponse.json({ data: stages });
}
