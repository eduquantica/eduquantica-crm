import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { KpiPeriod } from "@prisma/client";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";

const targetInputSchema = z.object({
  staffId: z.string().min(1),
  period: z.nativeEnum(KpiPeriod),
  periodLabel: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  targetLeadsContacted: z.number().min(0),
  targetLeadToStudent: z.number().min(0),
  targetStudentToOffer: z.number().min(0),
  targetOfferToDeposit: z.number().min(0),
  targetDepositToVisa: z.number().min(0),
  targetVisaToEnrolled: z.number().min(0),
  targetOverallConversion: z.number().min(0),
  targetEnrollments: z.number().min(0),
});

function orgType(subAgentId: string) {
  return `SUBAGENT_${subAgentId}`;
}

export async function GET(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = req.nextUrl.searchParams.get("period") as KpiPeriod | null;

  const [targets, staffOptions] = await Promise.all([
    db.kpiTarget.findMany({
      where: {
        organisationType: orgType(scope.subAgentId),
        ...(period ? { period } : {}),
        ...(scope.isBranchCounsellor ? { staffId: scope.userId } : {}),
      },
      include: {
        staff: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ staff: { name: "asc" } }, { startDate: "desc" }],
    }),
    db.user.findMany({
      where: {
        isActive: true,
        OR: [
          { subAgent: { id: scope.subAgentId } },
          { subAgentStaff: { subAgentId: scope.subAgentId, isActive: true } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    data: {
      targets,
      staffOptions: staffOptions.map((item) => ({ id: item.id, name: item.name || item.email, email: item.email })),
    },
  });
}

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (scope.isBranchCounsellor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = targetInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const staffBelongs = await db.user.findFirst({
    where: {
      id: payload.staffId,
      OR: [
        { subAgent: { id: scope.subAgentId } },
        { subAgentStaff: { subAgentId: scope.subAgentId } },
      ],
    },
    select: { id: true },
  });

  if (!staffBelongs) return NextResponse.json({ error: "Invalid branch counsellor" }, { status: 400 });

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid period dates" }, { status: 400 });
  }

  const existing = await db.kpiTarget.findFirst({
    where: {
      organisationId: scope.subAgentId,
      organisationType: orgType(scope.subAgentId),
      staffId: payload.staffId,
      period: payload.period,
      periodLabel: payload.periodLabel,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const data = {
    organisationId: scope.subAgentId,
    organisationType: orgType(scope.subAgentId),
    staffId: payload.staffId,
    period: payload.period,
    periodLabel: payload.periodLabel,
    startDate,
    endDate,
    targetLeadsContacted: payload.targetLeadsContacted,
    targetLeadToStudent: payload.targetLeadToStudent,
    targetStudentToOffer: payload.targetStudentToOffer,
    targetOfferToDeposit: payload.targetOfferToDeposit,
    targetDepositToVisa: payload.targetDepositToVisa,
    targetVisaToEnrolled: payload.targetVisaToEnrolled,
    targetOverallConversion: payload.targetOverallConversion,
    targetEnrollments: payload.targetEnrollments,
    overriddenByManager: true,
    overriddenByManagerId: scope.userId,
  };

  const target = existing
    ? await db.kpiTarget.update({ where: { id: existing.id }, data })
    : await db.kpiTarget.create({ data });

  return NextResponse.json({ ok: true, data: target });
}
