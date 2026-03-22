import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateKpiResults } from "@/lib/kpi-calculator";

function ensureDashboardKpiRole(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureDashboardKpiRole(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodLabel = req.nextUrl.searchParams.get("periodLabel") || "";
  const staffId = req.nextUrl.searchParams.get("staffId") || "";

  const where = {
    kpiTarget: { organisationType: "EDUQUANTICA" },
    ...(periodLabel ? { periodLabel } : {}),
    ...(staffId ? { staffId } : {}),
    ...(session.user.roleName === "COUNSELLOR" ? { staffId: session.user.id } : {}),
  };

  const results = await db.kpiResult.findMany({
    where,
    include: {
      staff: { select: { id: true, name: true, email: true } },
      kpiTarget: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ data: results });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetId = body.targetId as string;
  if (!targetId) return NextResponse.json({ error: "targetId is required" }, { status: 400 });

  const target = await db.kpiTarget.findUnique({ where: { id: targetId } });
  if (!target || target.organisationType !== "EDUQUANTICA") {
    return NextResponse.json({ error: "KPI target not found" }, { status: 404 });
  }

  const result = await calculateKpiResults({
    staffId: target.staffId,
    period: target.period,
    periodLabel: target.periodLabel,
    startDate: target.startDate,
    endDate: target.endDate,
    kpiTargetId: target.id,
  });

  return NextResponse.json({ ok: true, data: result });
}
