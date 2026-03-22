import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";
import { IN_PROGRESS_STATUSES } from "@/lib/agent-dashboard";
import { CurrencyService } from "@/lib/currency";

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  UK: "GBP",
  GB: "GBP",
  BANGLADESH: "BDT",
  BD: "BDT",
  INDIA: "INR",
  IN: "INR",
  NIGERIA: "NGN",
  NG: "NGN",
  PAKISTAN: "PKR",
  PK: "PKR",
  GHANA: "GHS",
  GH: "GHS",
  CANADA: "CAD",
  CA: "CAD",
  AUSTRALIA: "AUD",
  AU: "AUD",
  USA: "USD",
  US: "USD",
};

function toCurrencyFromCountry(country?: string | null) {
  if (!country) return "USD";
  const key = country.trim().toUpperCase();
  return COUNTRY_TO_CURRENCY[key] || "USD";
}

function parseInvoiceCommissionIds(raw: string | null) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw) as { commissionIds?: string[] };
    return Array.isArray(parsed.commissionIds) ? parsed.commissionIds : [];
  } catch {
    return [] as string[];
  }
}

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentWhere = getAgentStudentWhere(scope);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const subAgent = await db.subAgent.findUnique({
    where: { id: scope.subAgentId },
    select: {
      id: true,
      referralCode: true,
      agencyCountry: true,
      userId: true,
      agencyName: true,
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const [
    totalStudents,
    totalApplications,
    activeApplications,
    enrolledRows,
    referralRegistrations,
  ] = await Promise.all([
    db.student.count({ where: studentWhere }),
    db.application.count({ where: { student: studentWhere } }),
    db.application.count({
      where: {
        student: studentWhere,
        status: { in: IN_PROGRESS_STATUSES },
      },
    }),
    db.application.findMany({
      where: {
        student: studentWhere,
        status: "ENROLLED",
        enrolledAt: { gte: yearStart },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    db.student.count({ where: { referredBySubAgentId: scope.subAgentId } }),
  ]);

  const enrolledThisYear = enrolledRows.length;

  let pendingCommissionsGbp = 0;
  let paidCommissionsGbp = 0;
  const canViewFinancials = !["BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(scope.roleName);

  if (!scope.isBranchCounsellor && canViewFinancials) {
    const [commissions, approvedInvoices] = await Promise.all([
      db.commission.findMany({
        where: {
          application: {
            student: {
              subAgentId: scope.subAgentId,
            },
          },
          status: { in: ["CALCULATED", "INVOICED", "PAID"] },
        },
        select: {
          id: true,
          status: true,
          currency: true,
          agentAmount: true,
          createdAt: true,
        },
      }),
      db.subAgentInvoice.findMany({
        where: {
          subAgentId: scope.subAgentId,
          status: "APPROVED",
        },
        select: { bankDetails: true },
      }),
    ]);

    const approvedCommissionIds = new Set<string>();
    for (const invoice of approvedInvoices) {
      for (const id of parseInvoiceCommissionIds(invoice.bankDetails)) {
        approvedCommissionIds.add(id);
      }
    }

    for (const commission of commissions) {
      const amount = commission.agentAmount || 0;
      const rateToGbp = commission.currency === "GBP"
        ? 1
        : await CurrencyService.getRate(commission.currency, "GBP").then((rate) => rate || 0);
      const amountGbp = amount * rateToGbp;

      const isApproved = approvedCommissionIds.has(commission.id);
      const isPending = commission.status === "CALCULATED" || commission.status === "INVOICED" || isApproved;
      if (isPending) pendingCommissionsGbp += amountGbp;

      if (commission.status === "PAID" && commission.createdAt >= yearStart) {
        paidCommissionsGbp += amountGbp;
      }
    }
  }

  const conversionRate = totalStudents > 0
    ? Number(((enrolledThisYear / totalStudents) * 100).toFixed(1))
    : 0;
  const avgApplicationsPerStudent = totalStudents > 0
    ? Number((totalApplications / totalStudents).toFixed(2))
    : 0;

  const dualCurrency = toCurrencyFromCountry(subAgent.agencyCountry);
  const dualRate = dualCurrency === "GBP" ? 1 : (await CurrencyService.getRate("GBP", dualCurrency)) || 0;

  return NextResponse.json({
    data: {
      isBranchCounsellor: scope.isBranchCounsellor,
      canViewFinancials,
      referral: {
        referralCode: subAgent.referralCode,
        referralUrl: subAgent.referralCode
          ? `https://app.eduquantica.com/register?ref=${subAgent.referralCode}`
          : null,
        registrations: referralRegistrations,
        agencyName: subAgent.agencyName,
      },
      cards: {
        myStudents: totalStudents,
        activeApplications,
        totalApplications,
        avgApplicationsPerStudent,
        enrolledThisYear,
        pendingCommissions: {
          gbp: Number(pendingCommissionsGbp.toFixed(2)),
          dualCurrency,
          dualAmount: Number((pendingCommissionsGbp * dualRate).toFixed(2)),
        },
        paidCommissions: {
          gbp: Number(paidCommissionsGbp.toFixed(2)),
          dualCurrency,
          dualAmount: Number((paidCommissionsGbp * dualRate).toFixed(2)),
        },
        conversionRate,
      },
    },
  });
}
