import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CommissionStatus, InvoiceStatus } from "@prisma/client";

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function monthRange(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, mon] = month.split("-").map((v) => Number(v));
  if (!year || !mon || mon < 1 || mon > 12) return null;

  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
  return { start, end };
}

function asCommissionStatus(value: string | null) {
  if (!value || value === "ALL") return null;
  if (Object.values(CommissionStatus).includes(value as CommissionStatus)) {
    return value as CommissionStatus;
  }
  return null;
}

function asInvoiceStatus(value: string | null) {
  if (!value || value === "ALL") return null;
  if (Object.values(InvoiceStatus).includes(value as InvoiceStatus)) {
    return value as InvoiceStatus;
  }
  return null;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(year, (month || 1) - 1, 1));
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function parseCommissionIds(bankDetails: string | null) {
  if (!bankDetails) return [] as string[];
  try {
    const parsed = JSON.parse(bankDetails) as { commissionIds?: string[] };
    return Array.isArray(parsed.commissionIds) ? parsed.commissionIds.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const search = (p.get("search") || "").trim();
  const subAgentId = p.get("subAgentId") || "ALL";
  const commissionStatus = asCommissionStatus(p.get("commissionStatus"));
  const invoiceStatus = asInvoiceStatus(p.get("invoiceStatus"));
  const selectedMonth = monthRange(p.get("month"));

  const now = new Date();
  const from12 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0, 0));
  const to12 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  const baseCommissionWhere = {
    ...(subAgentId !== "ALL" ? { subAgentId } : {}),
    ...(selectedMonth
      ? {
          createdAt: {
            gte: selectedMonth.start,
            lt: selectedMonth.end,
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" as const } },
            { application: { student: { firstName: { contains: search, mode: "insensitive" as const } } } },
            { application: { student: { lastName: { contains: search, mode: "insensitive" as const } } } },
            { application: { course: { name: { contains: search, mode: "insensitive" as const } } } },
            { application: { course: { university: { name: { contains: search, mode: "insensitive" as const } } } } },
            { subAgent: { agencyName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const baseInvoiceWhere = {
    ...(subAgentId !== "ALL" ? { subAgentId } : {}),
    ...(selectedMonth
      ? {
          submittedAt: {
            gte: selectedMonth.start,
            lt: selectedMonth.end,
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" as const } },
            { subAgent: { agencyName: { contains: search, mode: "insensitive" as const } } },
            { subAgent: { user: { email: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [
    totalCommissions,
    pendingArrivalCount,
    invoicedAgg,
    paidAgg,
    chartCommissions,
    allCommissions,
    pendingArrival,
    invoices,
    approvedInvoices,
    subAgents,
  ] = await Promise.all([
    db.commission.count({ where: baseCommissionWhere }),
    db.commission.count({ where: { ...baseCommissionWhere, status: CommissionStatus.PENDING_ARRIVAL } }),
    db.commission.aggregate({ where: { ...baseCommissionWhere, status: CommissionStatus.INVOICED }, _sum: { agentAmount: true } }),
    db.commission.aggregate({ where: { ...baseCommissionWhere, status: CommissionStatus.PAID }, _sum: { agentAmount: true } }),
    db.commission.findMany({
      where: {
        ...(subAgentId !== "ALL" ? { subAgentId } : {}),
        createdAt: { gte: from12, lt: to12 },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.commission.findMany({
      where: {
        ...baseCommissionWhere,
        ...(commissionStatus ? { status: commissionStatus } : {}),
      },
      select: {
        id: true,
        applicationId: true,
        subAgentId: true,
        currency: true,
        status: true,
        agentRateAtTime: true,
        agentAmount: true,
        grossCommission: true,
        visaApprovedAt: true,
        enrolmentConfirmedAt: true,
        createdAt: true,
        application: {
          select: {
            student: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: {
                name: true,
                university: {
                  select: { name: true },
                },
              },
            },
          },
        },
        subAgent: {
          select: {
            agencyName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.commission.findMany({
      where: {
        ...baseCommissionWhere,
        status: CommissionStatus.PENDING_ARRIVAL,
      },
      select: {
        id: true,
        currency: true,
        createdAt: true,
        visaApprovedAt: true,
        application: {
          select: {
            student: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: {
                name: true,
                university: {
                  select: { name: true },
                },
              },
            },
          },
        },
        subAgent: {
          select: {
            agencyName: true,
          },
        },
      },
      orderBy: { visaApprovedAt: "desc" },
      take: 300,
    }),
    db.subAgentInvoice.findMany({
      where: {
        ...baseInvoiceWhere,
        ...(invoiceStatus ? { status: invoiceStatus } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        currency: true,
        submittedAt: true,
        status: true,
        pdfUrl: true,
        adminNote: true,
        paymentRef: true,
        paidAt: true,
        subAgent: {
          select: {
            agencyName: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 300,
    }),
    db.subAgentInvoice.findMany({
      where: {
        ...(subAgentId !== "ALL" ? { subAgentId } : {}),
        status: InvoiceStatus.APPROVED,
      },
      select: {
        bankDetails: true,
      },
      take: 500,
    }),
    db.subAgent.findMany({
      where: { isApproved: true },
      select: { id: true, agencyName: true },
      orderBy: { agencyName: "asc" },
    }),
  ]);

  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(monthKey(d));
  }

  const chartMap = new Map<string, { pendingArrival: number; calculated: number; invoiced: number; paid: number }>();
  for (const key of monthKeys) {
    chartMap.set(key, { pendingArrival: 0, calculated: 0, invoiced: 0, paid: 0 });
  }

  for (const row of chartCommissions) {
    const key = monthKey(row.createdAt);
    const bucket = chartMap.get(key);
    if (!bucket) continue;

    if (row.status === CommissionStatus.PENDING_ARRIVAL) bucket.pendingArrival += 1;
    if (row.status === CommissionStatus.CALCULATED) bucket.calculated += 1;
    if (row.status === CommissionStatus.INVOICED) bucket.invoiced += 1;
    if (row.status === CommissionStatus.PAID) bucket.paid += 1;
  }

  const chart = monthKeys.map((key) => ({
    month: monthLabel(key),
    pendingArrival: chartMap.get(key)?.pendingArrival || 0,
    calculated: chartMap.get(key)?.calculated || 0,
    invoiced: chartMap.get(key)?.invoiced || 0,
    paid: chartMap.get(key)?.paid || 0,
  }));

  const approvedCommissionIds = new Set<string>();
  for (const row of approvedInvoices) {
    for (const commissionId of parseCommissionIds(row.bankDetails)) {
      approvedCommissionIds.add(commissionId);
    }
  }

  return NextResponse.json({
    data: {
      summary: {
        totalCommissions,
        pendingArrivalCount,
        invoicedAmount: invoicedAgg._sum.agentAmount || 0,
        paidAmount: paidAgg._sum.agentAmount || 0,
      },
      chart,
      filters: {
        subAgents,
      },
      tables: {
        allCommissions: allCommissions.map((row) => ({
          id: row.id,
          applicationId: row.applicationId,
          subAgentId: row.subAgentId,
          studentName: `${row.application.student.firstName} ${row.application.student.lastName}`.trim(),
          university: row.application.course.university.name,
          course: row.application.course.name,
          agencyName: row.subAgent?.agencyName || "-",
          currency: row.currency,
          grossCommission: row.grossCommission,
          agentRate: row.agentRateAtTime,
          agentAmount: row.agentAmount,
          uiStatus: approvedCommissionIds.has(row.id) ? "APPROVED" : row.status,
          status: row.status,
          visaApprovedAt: row.visaApprovedAt,
          enrolmentConfirmedAt: row.enrolmentConfirmedAt,
          createdAt: row.createdAt,
        })),
        pendingArrival: pendingArrival.map((row) => ({
          id: row.id,
          studentName: `${row.application.student.firstName} ${row.application.student.lastName}`.trim(),
          university: row.application.course.university.name,
          course: row.application.course.name,
          agencyName: row.subAgent?.agencyName || "-",
          currency: row.currency,
          visaApprovedAt: row.visaApprovedAt,
          createdAt: row.createdAt,
        })),
        invoices,
      },
    },
  });
}
