import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function ensureRole(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureRole(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodLabel = req.nextUrl.searchParams.get("periodLabel") || "";

  const rows = await db.kpiResult.findMany({
    where: {
      kpiTarget: { organisationType: "EDUQUANTICA" },
      ...(periodLabel ? { periodLabel } : {}),
      ...(session.user.roleName === "COUNSELLOR" ? { staffId: session.user.id } : {}),
    },
    include: {
      staff: { select: { id: true, name: true, email: true } },
      kpiTarget: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const latestByStaff = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByStaff.has(row.staffId)) latestByStaff.set(row.staffId, row);
  }

  const latestRows = Array.from(latestByStaff.values());
  const avg = (selector: (r: (typeof latestRows)[number]) => number) =>
    latestRows.length ? Math.round((latestRows.reduce((sum, row) => sum + selector(row), 0) / latestRows.length) * 100) / 100 : 0;

  return NextResponse.json({
    data: {
      rows: latestRows,
      summary: {
        teamLeadContactRate: avg((r) => r.leadContactRate),
        teamConversionRate: avg((r) => r.overallConversionRate),
        teamEnrollments: latestRows.reduce((sum, row) => sum + row.actualEnrolled, 0),
        teamAchievement: avg((r) => r.achievementPercentage),
      },
    },
  });
}
