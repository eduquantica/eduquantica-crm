import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canView(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canView(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counsellors = await db.user.findMany({
    where: {
      role: { name: "COUNSELLOR" },
      isActive: true,
      subAgent: null,
      subAgentStaff: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      assignedLeads: {
        where: { subAgentId: null },
        select: { id: true, status: true },
      },
      counsellorStudents: {
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = counsellors.map((c) => {
    const leadsAllocated = c.assignedLeads.length;
    const leadsContacted = c.assignedLeads.filter((lead) => lead.status !== "NEW").length;
    const leadsConverted = c.assignedLeads.filter((lead) => lead.status === "CONVERTED").length;

    return {
      counsellorId: c.id,
      counsellorName: c.name || c.email,
      leadsAllocated,
      leadsContacted,
      leadsConvertedToStudents: Math.max(leadsConverted, c.counsellorStudents.length),
      contactRate: pct(leadsContacted, leadsAllocated),
      conversionRate: pct(Math.max(leadsConverted, c.counsellorStudents.length), leadsContacted),
    };
  });

  return NextResponse.json({ data: rows });
}
