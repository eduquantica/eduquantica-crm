import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canViewPL,
  cleanString,
  ensureOfficeAccess,
  getPLScope,
  parsePLFilters,
} from "@/lib/pl";

function toMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Number(numberValue.toFixed(2));
}

function toDynamicItems(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ label: string; amount: number }>;
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const label = cleanString((entry as { label?: unknown }).label);
      const amount = toMoney((entry as { amount?: unknown }).amount);
      if (!label || amount <= 0) return null;
      return { label, amount };
    })
    .filter((entry): entry is { label: string; amount: number } => Boolean(entry));
}

function expenseTotal(payload: {
  rent: number;
  salaries: number;
  marketing: number;
  operations: number;
  legal: number;
  travel: number;
  otherExpenses: Array<{ label: string; amount: number }>;
}) {
  const otherTotal = payload.otherExpenses.reduce((sum, row) => sum + row.amount, 0);
  return Number(
    (
      payload.rent +
      payload.salaries +
      payload.marketing +
      payload.operations +
      payload.legal +
      payload.travel +
      otherTotal
    ).toFixed(2),
  );
}

function periodKey(officeId: string | null, agentId: string | null, month: number, year: number) {
  return `${officeId || "global"}:${agentId || "global"}:${year}:${month}`;
}

export async function GET(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filters = parsePLFilters(req.nextUrl.searchParams);
  const scopedSubAgentId = scope.kind === "agent" ? scope.subAgentId : filters.subAgentId;

  const rows = await db.pLExpense.findMany({
    where: {
      ...(scopedSubAgentId ? { agentId: scopedSubAgentId } : {}),
      ...(filters.officeId ? { officeId: filters.officeId } : {}),
      year: filters.year,
      ...(filters.month ? { month: filters.month } : {}),
    },
    select: {
      id: true,
      rent: true,
      salaries: true,
      marketing: true,
      operations: true,
      legal: true,
      travel: true,
      otherExpenses: true,
      totalExpenses: true,
      currency: true,
      month: true,
      year: true,
      officeId: true,
      agentId: true,
      createdAt: true,
      office: {
        select: {
          id: true,
          officeName: true,
          country: true,
          city: true,
        },
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      office: row.office ? { ...row.office, name: row.office.officeName } : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const currentDate = new Date();
  const month = Number(body?.month);
  const year = Number(body?.year);
  const targetMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : currentDate.getUTCMonth() + 1;
  const targetYear = Number.isInteger(year) && year > 2000 ? year : currentDate.getUTCFullYear();

  const currency = cleanString(body?.currency) || "GBP";
  const officeId = cleanString(body?.officeId);
  const inputAgentId = cleanString(body?.agentId || body?.subAgentId) || null;
  const agentId = scope.kind === "agent" ? scope.subAgentId : inputAgentId;

  const rent = toMoney(body?.rent);
  const salaries = toMoney(body?.salaries);
  const marketing = toMoney(body?.marketing);
  const operations = toMoney(body?.operations);
  const legal = toMoney(body?.legal);
  const travel = toMoney(body?.travel);
  const otherExpenses = toDynamicItems(body?.otherExpenses);
  const totalExpenses = expenseTotal({
    rent,
    salaries,
    marketing,
    operations,
    legal,
    travel,
    otherExpenses,
  });

  let resolvedOfficeId: string | null = null;
  if (officeId) {
    const office = await ensureOfficeAccess(scope, officeId);
    if (!office) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }
    resolvedOfficeId = office.id;
  }

  const key = periodKey(resolvedOfficeId, agentId, targetMonth, targetYear);

  const row = await db.pLExpense.upsert({
    where: { periodKey: key },
    create: {
      officeId: resolvedOfficeId,
      agentId,
      rent,
      salaries,
      marketing,
      operations,
      legal,
      travel,
      otherExpenses,
      totalExpenses,
      currency,
      month: targetMonth,
      year: targetYear,
      periodKey: key,
      incurredDate: new Date(Date.UTC(targetYear, targetMonth - 1, 1)),
      expenseType: "MONTHLY_STATEMENT",
      amount: totalExpenses,
      isCostOfSale: false,
      createdById: scope.userId,
    },
    update: {
      rent,
      salaries,
      marketing,
      operations,
      legal,
      travel,
      otherExpenses,
      totalExpenses,
      amount: totalExpenses,
      expenseType: "MONTHLY_STATEMENT",
      currency,
      officeId: resolvedOfficeId,
      agentId,
    },
  });

  return NextResponse.json({ data: row }, { status: 201 });
}