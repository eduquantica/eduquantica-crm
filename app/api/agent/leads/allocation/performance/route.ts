import { NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staff = await db.subAgentStaff.findMany({
    where: { subAgentId: scope.subAgentId, isActive: true },
    select: {
      userId: true,
      name: true,
      subAgent: {
        select: {
          leads: {
            where: { assignedCounsellorId: { not: null } },
            select: { assignedCounsellorId: true, status: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const leads = await db.lead.findMany({
    where: { subAgentId: scope.subAgentId, assignedCounsellorId: { not: null } },
    select: { assignedCounsellorId: true, status: true },
  });

  const rows = staff.map((item) => {
    const assigned = leads.filter((lead) => lead.assignedCounsellorId === item.userId);
    const leadsAllocated = assigned.length;
    const leadsContacted = assigned.filter((lead) => lead.status !== "NEW").length;
    const leadsConverted = assigned.filter((lead) => lead.status === "CONVERTED").length;

    return {
      counsellorId: item.userId,
      counsellorName: item.name,
      leadsAllocated,
      leadsContacted,
      leadsConvertedToStudents: leadsConverted,
      contactRate: pct(leadsContacted, leadsAllocated),
      conversionRate: pct(leadsConverted, leadsContacted),
    };
  });

  return NextResponse.json({ data: rows });
}
