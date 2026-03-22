import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { KpiPeriod } from "@prisma/client";
import { z } from "zod";

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
  setByAdminDefault: z.boolean().optional(),
});

function ensureDashboardKpiRole(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

async function isEduCounsellor(staffId: string) {
  const user = await db.user.findUnique({
    where: { id: staffId },
    select: {
      role: { select: { name: true, label: true } },
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { id: true } },
      name: true,
      email: true,
    },
  });

  if (!user || user.subAgent || user.subAgentStaff || user.role.name !== "COUNSELLOR") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureDashboardKpiRole(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get("period") as KpiPeriod | null;

  const where = {
    organisationType: "EDUQUANTICA",
    ...(period ? { period } : {}),
    ...(session.user.roleName === "COUNSELLOR" ? { staffId: session.user.id } : {}),
  };

  const [targets, staffOptions] = await Promise.all([
    db.kpiTarget.findMany({
      where,
      include: {
        staff: {
          select: { id: true, name: true, email: true, role: { select: { name: true, label: true } } },
        },
      },
      orderBy: [{ staff: { name: "asc" } }, { startDate: "desc" }],
    }),
    db.user.findMany({
      where: {
        role: { name: "COUNSELLOR" },
        isActive: true,
        subAgent: null,
        subAgentStaff: null,
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
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = targetInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const staff = await isEduCounsellor(payload.staffId);
  if (!staff) return NextResponse.json({ error: "Invalid counsellor" }, { status: 400 });

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid period dates" }, { status: 400 });
  }

  const existing = await db.kpiTarget.findFirst({
    where: {
      organisationType: "EDUQUANTICA",
      staffId: payload.staffId,
      period: payload.period,
      periodLabel: payload.periodLabel,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const data = {
    organisationId: "EDUQUANTICA",
    organisationType: "EDUQUANTICA",
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
    setByAdminDefault: payload.setByAdminDefault || false,
    overriddenByManager: session.user.roleName === "MANAGER",
    overriddenByManagerId: session.user.roleName === "MANAGER" ? session.user.id : null,
  };

  const target = existing
    ? await db.kpiTarget.update({ where: { id: existing.id }, data })
    : await db.kpiTarget.create({ data });

  return NextResponse.json({ ok: true, data: target });
}
