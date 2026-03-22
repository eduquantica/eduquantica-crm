import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (["BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(scope.roleName)) {
    return NextResponse.json({
      data: {
        expected: 0,
        pendingInvoice: 0,
        paidYtd: 0,
        currency: "GBP",
        recentPayouts: [],
      },
    });
  }

  const studentWhere = getAgentStudentWhere(scope);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const commissions = await db.commission.findMany({
    where: {
      application: {
        student: studentWhere,
      },
      status: { in: ["CALCULATED", "INVOICED", "PAID"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      currency: true,
      agentAmount: true,
      createdAt: true,
      application: {
        select: {
          id: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  const expected = commissions.reduce((sum, item) => sum + (item.agentAmount || 0), 0);
  const pendingInvoice = commissions
    .filter((item) => item.status === "CALCULATED" || item.status === "INVOICED")
    .reduce((sum, item) => sum + (item.agentAmount || 0), 0);
  const paidYtd = commissions
    .filter((item) => item.status === "PAID" && item.createdAt >= yearStart)
    .reduce((sum, item) => sum + (item.agentAmount || 0), 0);

  const recentPayouts = commissions
    .filter((item) => item.status === "PAID")
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      studentName: `${item.application.student.firstName} ${item.application.student.lastName}`.trim(),
      amount: item.agentAmount || 0,
      currency: item.currency,
      paidAt: item.createdAt.toISOString(),
      href: `/agent/commissions`,
    }));

  return NextResponse.json({
    data: {
      expected: Number(expected.toFixed(2)),
      pendingInvoice: Number(pendingInvoice.toFixed(2)),
      paidYtd: Number(paidYtd.toFixed(2)),
      currency: "GBP",
      recentPayouts,
    },
  });
}
