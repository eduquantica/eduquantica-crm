import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CommissionStatus } from "@prisma/client";

type UiStatus = "CALCULATED" | "INVOICED" | "APPROVED" | "PAID" | "PENDING_ARRIVAL" | "CANCELLED";

const STATUS_FILTERS = new Set(["ALL", "CALCULATED", "INVOICED", "APPROVED", "PAID"]);

type InvoiceBankDetails = {
  commissionIds?: string[];
};

function parseBankDetails(value: string | null): InvoiceBankDetails {
  if (!value) return {};
  try {
    return JSON.parse(value) as InvoiceBankDetails;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const filterRaw = (req.nextUrl.searchParams.get("status") || "ALL").toUpperCase();
  const filter = STATUS_FILTERS.has(filterRaw) ? filterRaw : "ALL";

  const commissions = await db.commission.findMany({
    where: {
      subAgentId: subAgent.id,
      status: filter === "CALCULATED"
        ? CommissionStatus.CALCULATED
        : filter === "INVOICED"
          ? CommissionStatus.INVOICED
          : filter === "PAID"
            ? CommissionStatus.PAID
            : undefined,
    },
    select: {
      id: true,
      agentRateAtTime: true,
      agentAmount: true,
      status: true,
      currency: true,
      application: {
        select: {
          createdAt: true,
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
    },
    orderBy: { createdAt: "desc" },
  });

  const approvedInvoices = await db.subAgentInvoice.findMany({
    where: {
      subAgentId: subAgent.id,
      status: "APPROVED",
    },
    select: {
      bankDetails: true,
    },
  });

  const approvedCommissionIds = new Set<string>();
  for (const invoice of approvedInvoices) {
    const details = parseBankDetails(invoice.bankDetails);
    for (const id of details.commissionIds || []) {
      approvedCommissionIds.add(id);
    }
  }

  const rows = commissions
    .map((commission) => {
      const studentName = `${commission.application.student.firstName} ${commission.application.student.lastName}`.trim();
      const baseStatus = commission.status as UiStatus;
      const status: UiStatus = approvedCommissionIds.has(commission.id) ? "APPROVED" : baseStatus;

      return {
        id: commission.id,
        studentName,
        university: commission.application.course.university.name,
        course: commission.application.course.name,
        intake: commission.application.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
        agentRate: commission.agentRateAtTime ?? 0,
        agentAmount: commission.agentAmount ?? 0,
        currency: commission.currency,
        status,
      };
    })
    .filter((row) => (filter === "APPROVED" ? row.status === "APPROVED" : true));

  const totalEarned = commissions.reduce((sum, c) => sum + (c.agentAmount ?? 0), 0);
  const totalPaid = commissions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + (c.agentAmount ?? 0), 0);
  const pendingPayment = rows
    .filter((r) => r.status === "INVOICED" || r.status === "APPROVED")
    .reduce((sum, r) => sum + r.agentAmount, 0);
  const uninvoiced = commissions
    .filter((c) => c.status === "CALCULATED")
    .reduce((sum, c) => sum + (c.agentAmount ?? 0), 0);

  return NextResponse.json({
    data: {
      summary: {
        totalEarned,
        totalPaid,
        pendingPayment,
        uninvoiced,
      },
      rows,
    },
  });
}
