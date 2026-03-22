import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canViewPL,
  cleanString,
  ensureOfficeAccess,
  getPLIncomeBreakdown,
  getPLScope,
  parsePLFilters,
  serialiseIncomeOverrides,
  type PLIncomeSourceKey,
} from "@/lib/pl";

function toMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Number(numberValue.toFixed(2));
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
  const displayCurrency = cleanString(req.nextUrl.searchParams.get("currency") || "GBP").toUpperCase() || "GBP";
  const data = await getPLIncomeBreakdown(scope, filters, displayCurrency);

  return NextResponse.json({
    data,
  });
}

function parseOverridePayload(body: Record<string, unknown>) {
  const sourceKeys: PLIncomeSourceKey[] = [
    "fileOpeningCharge",
    "serviceRelatedCharges",
    "airportPickup",
    "applicationFees",
    "ucasFee",
    "otherInvoiceItems",
    "studentCommission",
  ];

  const parsed: Partial<Record<PLIncomeSourceKey, number>> = {};

  if (body.overrides && typeof body.overrides === "object") {
    for (const key of sourceKeys) {
      const value = toMoney((body.overrides as Record<string, unknown>)[key]);
      if (value > 0) parsed[key] = value;
    }
    return parsed;
  }

  const legacyStudentCommission = toMoney(body.studentCommission);
  const legacyService = toMoney(body.serviceCharge);
  const legacyApplication = toMoney(body.applicationFee);
  if (legacyStudentCommission > 0) parsed.studentCommission = legacyStudentCommission;
  if (legacyService > 0) parsed.serviceRelatedCharges = legacyService;
  if (legacyApplication > 0) parsed.applicationFees = legacyApplication;

  return parsed;
}

export async function POST(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.kind !== "admin") {
    return NextResponse.json({ error: "Income overrides can only be updated by admin users" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const currentDate = new Date();
  const month = Number(body?.month);
  const year = Number(body?.year);
  const targetMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : currentDate.getUTCMonth() + 1;
  const targetYear = Number.isInteger(year) && year > 2000 ? year : currentDate.getUTCFullYear();

  const currency = cleanString(body?.currency) || "GBP";
  const officeId = cleanString(body?.officeId);
  const agentId = cleanString(body?.agentId || body?.subAgentId) || null;
  const overrides = parseOverridePayload((body || {}) as Record<string, unknown>);
  const overrideRows = serialiseIncomeOverrides(overrides);
  const totalIncome = Number(overrideRows.reduce((sum, row) => sum + row.amount, 0).toFixed(2));

  let resolvedOfficeId: string | null = null;
  if (officeId) {
    const office = await ensureOfficeAccess(scope, officeId);
    if (!office) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }
    resolvedOfficeId = office.id;
  }

  const key = periodKey(resolvedOfficeId, agentId, targetMonth, targetYear);

  if (overrideRows.length === 0) {
    await db.pLIncome.deleteMany({ where: { periodKey: key } });
    return NextResponse.json({ data: null });
  }

  const row = await db.pLIncome.upsert({
    where: { periodKey: key },
    create: {
      officeId: resolvedOfficeId,
      agentId,
      studentCommission: overrides.studentCommission || 0,
      applicationFee: (overrides.applicationFees || 0) + (overrides.fileOpeningCharge || 0) + (overrides.airportPickup || 0) + (overrides.ucasFee || 0),
      serviceCharge: overrides.serviceRelatedCharges || 0,
      otherIncome: overrideRows,
      totalIncome,
      currency,
      month: targetMonth,
      year: targetYear,
      periodKey: key,
      receivedDate: new Date(Date.UTC(targetYear, targetMonth - 1, 1)),
      source: "MONTHLY_STATEMENT",
      amount: totalIncome,
      createdById: scope.userId,
    },
    update: {
      studentCommission: overrides.studentCommission || 0,
      applicationFee: (overrides.applicationFees || 0) + (overrides.fileOpeningCharge || 0) + (overrides.airportPickup || 0) + (overrides.ucasFee || 0),
      serviceCharge: overrides.serviceRelatedCharges || 0,
      otherIncome: overrideRows,
      totalIncome,
      currency,
      amount: totalIncome,
      source: "MONTHLY_STATEMENT",
      officeId: resolvedOfficeId,
      agentId,
    },
  });

  return NextResponse.json({ data: row }, { status: 201 });
}