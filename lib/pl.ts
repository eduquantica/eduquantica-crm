import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAgentScope } from "@/lib/agent-scope";
import { CurrencyService } from "@/lib/currency";

export type PLScope =
  | {
      kind: "admin";
      roleName: string;
      userId: string;
    }
  | {
      kind: "agent";
      roleName: string;
      userId: string;
      subAgentId: string;
      isBranchCounsellor: boolean;
    };

export type PLSummaryFilters = {
  year: number;
  month: number | null;
  officeId: string | null;
  subAgentId: string | null;
};

export type PLIncomeSourceKey =
  | "fileOpeningCharge"
  | "serviceRelatedCharges"
  | "airportPickup"
  | "applicationFees"
  | "ucasFee"
  | "otherInvoiceItems"
  | "studentCommission";

export type PLIncomeSourceRow = {
  key: PLIncomeSourceKey;
  label: string;
  autoAmount: number;
  overrideAmount: number | null;
  finalAmount: number;
};

export type PLIncomeBreakdown = {
  month: number | null;
  year: number;
  officeId: string | null;
  agentId: string | null;
  sourceRows: PLIncomeSourceRow[];
  totals: {
    autoTotal: number;
    finalTotal: number;
  };
  displayCurrency: string;
  counts: {
    paidInvoices: number;
    paidCommissions: number;
  };
  hasAutoData: boolean;
  overrideRecordId: string | null;
};

type OfficeRecord = {
  id: string;
  officeName: string;
  country: string;
  city: string | null;
  currency: string;
};

type IncomeRecord = {
  id: string;
  studentCommission: number;
  applicationFee: number;
  serviceCharge: number;
  otherIncome: unknown[];
  totalIncome: number;
  currency: string;
  month: number;
  year: number;
  receivedDate: Date | null;
  agentId: string | null;
  office: OfficeRecord | null;
};

type ExpenseRecord = {
  id: string;
  rent: number;
  salaries: number;
  marketing: number;
  operations: number;
  legal: number;
  travel: number;
  otherExpenses: unknown[];
  totalExpenses: number;
  currency: string;
  month: number;
  year: number;
  incurredDate: Date | null;
  isCostOfSale: boolean;
  agentId: string | null;
  office: OfficeRecord | null;
};

export async function getPLScope(): Promise<PLScope | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (session.user.roleName === "ADMIN" || session.user.roleName === "MANAGER") {
    return {
      kind: "admin",
      roleName: session.user.roleName,
      userId: session.user.id,
    };
  }

  const agentScope = await getAgentScope();
  if (!agentScope) return null;

  return {
    kind: "agent",
    roleName: agentScope.roleName,
    userId: agentScope.userId,
    subAgentId: agentScope.subAgentId,
    isBranchCounsellor: agentScope.isBranchCounsellor,
  };
}

export function canViewPL(scope: PLScope | null) {
  if (!scope) return false;
  if (scope.kind === "admin") return true;
  return !scope.isBranchCounsellor;
}

export function canManagePLOffices(scope: PLScope | null) {
  return scope?.kind === "admin";
}

export function getAccessibleOfficeFilter(scope: PLScope) {
  if (scope.kind === "admin") {
    return {};
  }

  return {
    OR: [
      { subAgentId: null },
      { subAgentId: scope.subAgentId },
    ],
  };
}

export async function ensureOfficeAccess(scope: PLScope, officeId: string) {
  return db.pLOffice.findFirst({
    where: {
      id: officeId,
      ...getAccessibleOfficeFilter(scope),
    },
    select: {
      id: true,
      officeName: true,
      country: true,
      city: true,
      currency: true,
      subAgentId: true,
      isActive: true,
    },
  });
}

export function parsePLFilters(searchParams: URLSearchParams): PLSummaryFilters {
  const now = new Date();
  const yearRaw = Number(searchParams.get("year"));
  const monthRaw = Number(searchParams.get("month"));

  return {
    year: Number.isInteger(yearRaw) && yearRaw > 2000 ? yearRaw : now.getUTCFullYear(),
    month: Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : null,
    officeId: (searchParams.get("officeId") || "").trim() || null,
    subAgentId: (searchParams.get("subAgentId") || "").trim() || null,
  };
}

export function normalisePLDateParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return {
    date,
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

export function clampAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Number(amount.toFixed(2));
}

export function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const INCOME_SOURCE_ORDER: Array<{ key: PLIncomeSourceKey; label: string }> = [
  { key: "fileOpeningCharge", label: "File Opening Charge" },
  { key: "serviceRelatedCharges", label: "Service Charges + Instalments" },
  { key: "airportPickup", label: "Airport Pickup" },
  { key: "applicationFees", label: "Application Fee" },
  { key: "ucasFee", label: "UCAS Fee" },
  { key: "otherInvoiceItems", label: "Other Invoice Items" },
  { key: "studentCommission", label: "Student Commission" },
];

const INCOME_OVERRIDE_PREFIX = "__override__:";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function getPeriodBounds(filters: PLSummaryFilters) {
  if (filters.month) {
    const from = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const to = new Date(Date.UTC(filters.year, filters.month, 1));
    return { from, to };
  }

  const from = new Date(Date.UTC(filters.year, 0, 1));
  const to = new Date(Date.UTC(filters.year + 1, 0, 1));
  return { from, to };
}

function getScopedAgentId(scope: PLScope, filters: PLSummaryFilters) {
  if (scope.kind === "agent") return scope.subAgentId;
  return filters.subAgentId;
}

function decodeOverrideMap(record: {
  studentCommission: number;
  applicationFee: number;
  serviceCharge: number;
  otherIncome: unknown[];
} | null): Partial<Record<PLIncomeSourceKey, number>> {
  if (!record) return {};

  const decoded: Partial<Record<PLIncomeSourceKey, number>> = {};
  for (const entry of Array.isArray(record.otherIncome) ? record.otherIncome : []) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { label?: unknown; amount?: unknown };
    const label = cleanString(row.label);
    if (!label.startsWith(INCOME_OVERRIDE_PREFIX)) continue;
    const key = label.slice(INCOME_OVERRIDE_PREFIX.length) as PLIncomeSourceKey;
    const amount = clampAmount(row.amount);
    if (!amount) continue;
    decoded[key] = amount;
  }

  if (decoded.studentCommission === undefined && record.studentCommission > 0) {
    decoded.studentCommission = roundMoney(record.studentCommission);
  }
  if (decoded.serviceRelatedCharges === undefined && record.serviceCharge > 0) {
    decoded.serviceRelatedCharges = roundMoney(record.serviceCharge);
  }
  if (decoded.applicationFees === undefined && record.applicationFee > 0) {
    decoded.applicationFees = roundMoney(record.applicationFee);
  }

  return decoded;
}

export async function getPLIncomeBreakdown(
  scope: PLScope,
  filters: PLSummaryFilters,
  displayCurrencyInput?: string,
): Promise<PLIncomeBreakdown> {
  const scopedAgentId = getScopedAgentId(scope, filters);
  const { from, to } = getPeriodBounds(filters);
  const displayCurrency = cleanString(displayCurrencyInput || "GBP").toUpperCase() || "GBP";

  const [paidInvoices, paidCommissions, overrideRow] = await Promise.all([
    db.studentInvoice.findMany({
      where: {
        status: "PAID",
        ...(scopedAgentId ? { student: { subAgentId: scopedAgentId } } : {}),
        OR: [
          { paidAt: { gte: from, lt: to } },
          { paidAt: null, updatedAt: { gte: from, lt: to } },
        ],
      },
      select: {
        fileOpeningCharge: true,
        serviceCharge: true,
        serviceInstalment1: true,
        serviceInstalment2: true,
        airportPickupFee: true,
        applicationFee: true,
        applicationFee2: true,
        ucasFee: true,
        otherAmount: true,
        currency: true,
      },
    }),
    db.commission.findMany({
      where: {
        status: "PAID",
        ...(scopedAgentId ? { subAgentId: scopedAgentId } : {}),
        createdAt: { gte: from, lt: to },
      },
      select: {
        eduquanticaNet: true,
        currency: true,
      },
    }),
    filters.month
      ? db.pLIncome.findFirst({
          where: {
            ...(scopedAgentId ? { agentId: scopedAgentId } : {}),
            ...(filters.officeId ? { officeId: filters.officeId } : { officeId: null }),
            year: filters.year,
            month: filters.month,
          },
          select: {
            id: true,
            studentCommission: true,
            applicationFee: true,
            serviceCharge: true,
            otherIncome: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const autoAmounts: Record<PLIncomeSourceKey, number> = {
    fileOpeningCharge: 0,
    serviceRelatedCharges: 0,
    airportPickup: 0,
    applicationFees: 0,
    ucasFee: 0,
    otherInvoiceItems: 0,
    studentCommission: 0,
  };

  const conversionRates = new Map<string, number>();
  conversionRates.set(displayCurrency, 1);

  const sourceCurrencies = new Set<string>();
  for (const invoice of paidInvoices) {
    sourceCurrencies.add(cleanString(invoice.currency || "").toUpperCase() || displayCurrency);
  }
  for (const commission of paidCommissions) {
    sourceCurrencies.add(cleanString(commission.currency || "").toUpperCase() || displayCurrency);
  }

  await Promise.all(
    Array.from(sourceCurrencies)
      .filter((currency) => currency && currency !== displayCurrency)
      .map(async (currency) => {
        const rate = await CurrencyService.getRate(currency, displayCurrency).catch(() => null);
        if (rate && Number.isFinite(rate) && rate > 0) {
          conversionRates.set(currency, rate);
        }
      }),
  );

  function convertAmount(amount: number | null | undefined, sourceCurrency: string | null | undefined) {
    const numeric = typeof amount === "number" ? amount : Number(amount || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    const fromCurrency = cleanString(sourceCurrency || "").toUpperCase() || displayCurrency;
    const rate = conversionRates.get(fromCurrency) ?? 1;
    return roundMoney(numeric * rate);
  }

  for (const invoice of paidInvoices) {
    autoAmounts.fileOpeningCharge += convertAmount(invoice.fileOpeningCharge, invoice.currency);
    autoAmounts.serviceRelatedCharges +=
      convertAmount(invoice.serviceCharge, invoice.currency) +
      convertAmount(invoice.serviceInstalment1, invoice.currency) +
      convertAmount(invoice.serviceInstalment2, invoice.currency);
    autoAmounts.airportPickup += convertAmount(invoice.airportPickupFee, invoice.currency);
    autoAmounts.applicationFees += convertAmount(invoice.applicationFee, invoice.currency) + convertAmount(invoice.applicationFee2, invoice.currency);
    autoAmounts.ucasFee += convertAmount(invoice.ucasFee, invoice.currency);
    autoAmounts.otherInvoiceItems += convertAmount(invoice.otherAmount, invoice.currency);
  }

  for (const commission of paidCommissions) {
    autoAmounts.studentCommission += convertAmount(commission.eduquanticaNet, commission.currency);
  }

  for (const key of Object.keys(autoAmounts) as PLIncomeSourceKey[]) {
    autoAmounts[key] = roundMoney(autoAmounts[key]);
  }

  const overrides = decodeOverrideMap(
    overrideRow
      ? {
          studentCommission: overrideRow.studentCommission,
          applicationFee: overrideRow.applicationFee,
          serviceCharge: overrideRow.serviceCharge,
          otherIncome: (overrideRow.otherIncome as unknown[]) || [],
        }
      : null,
  );

  const sourceRows = INCOME_SOURCE_ORDER.map((row) => {
    const overrideAmount = overrides[row.key] ?? null;
    const autoAmount = autoAmounts[row.key];
    const finalAmount = roundMoney(overrideAmount ?? autoAmount);
    return {
      key: row.key,
      label: row.label,
      autoAmount,
      overrideAmount,
      finalAmount,
    };
  });

  const autoTotal = roundMoney(sourceRows.reduce((sum, row) => sum + row.autoAmount, 0));
  const finalTotal = roundMoney(sourceRows.reduce((sum, row) => sum + row.finalAmount, 0));

  return {
    month: filters.month,
    year: filters.year,
    officeId: filters.officeId,
    agentId: scopedAgentId || null,
    sourceRows,
    totals: {
      autoTotal,
      finalTotal,
    },
    displayCurrency,
    counts: {
      paidInvoices: paidInvoices.length,
      paidCommissions: paidCommissions.length,
    },
    hasAutoData: paidInvoices.length > 0 || paidCommissions.length > 0,
    overrideRecordId: overrideRow?.id || null,
  };
}

export function serialiseIncomeOverrides(overrides: Partial<Record<PLIncomeSourceKey, number>>) {
  return INCOME_SOURCE_ORDER
    .map((row) => {
      const amount = clampAmount(overrides[row.key]);
      if (amount === null) return null;
      return {
        label: `${INCOME_OVERRIDE_PREFIX}${row.key}`,
        amount: roundMoney(amount),
      };
    })
    .filter((row): row is { label: string; amount: number } => Boolean(row));
}

export async function getPLSummary(scope: PLScope, filters: PLSummaryFilters) {
  const scopedSubAgentId = getScopedAgentId(scope, filters);
  const incomeWhere = {
    ...(scopedSubAgentId ? { agentId: scopedSubAgentId } : {}),
    ...(filters.officeId ? { officeId: filters.officeId } : {}),
    year: filters.year,
    ...(filters.month ? { month: filters.month } : {}),
  };
  const expenseWhere = {
    ...(scopedSubAgentId ? { agentId: scopedSubAgentId } : {}),
    ...(filters.officeId ? { officeId: filters.officeId } : {}),
    year: filters.year,
    ...(filters.month ? { month: filters.month } : {}),
  };

  const officeWhere = {
    ...getAccessibleOfficeFilter(scope),
    ...(scope.kind === "admin" && scopedSubAgentId ? { subAgentId: scopedSubAgentId } : {}),
    ...(filters.officeId ? { id: filters.officeId } : {}),
  };

  const [incomes, expenses, offices, incomeBreakdown] = await Promise.all([
    db.pLIncome.findMany({
      where: incomeWhere,
      select: {
        id: true,
        studentCommission: true,
        applicationFee: true,
        serviceCharge: true,
        otherIncome: true,
        totalIncome: true,
        currency: true,
        month: true,
        year: true,
        receivedDate: true,
        agentId: true,
        office: {
          select: {
            id: true,
            officeName: true,
            country: true,
            city: true,
            currency: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
    }),
    db.pLExpense.findMany({
      where: expenseWhere,
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
        incurredDate: true,
        isCostOfSale: true,
        agentId: true,
        office: {
          select: {
            id: true,
            officeName: true,
            country: true,
            city: true,
            currency: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
    }),
    db.pLOffice.findMany({
      where: officeWhere,
      select: {
        id: true,
        officeName: true,
        country: true,
        city: true,
        currency: true,
        isActive: true,
        subAgentId: true,
      },
      orderBy: [{ country: "asc" }, { officeName: "asc" }],
    }),
    getPLIncomeBreakdown(scope, filters),
  ]);

  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    costOfSales: 0,
    operatingExpenses: 0,
    netProfit: 0,
    margin: 0,
    recordCount: {
      income: incomes.length,
      expenses: expenses.length,
      offices: offices.length,
    },
  };

  const monthlyMap = new Map<number, { month: number; label: string; income: number; expenses: number; profit: number }>();
  for (let month = 1; month <= 12; month += 1) {
    const label = new Date(Date.UTC(filters.year, month - 1, 1)).toLocaleDateString("en-GB", {
      month: "short",
      timeZone: "UTC",
    });
    monthlyMap.set(month, { month, label, income: 0, expenses: 0, profit: 0 });
  }

  const byCountry = new Map<string, number>();
  const topIncomeSources = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();
  const officeBreakdown = new Map<string, {
    officeId: string;
    officeName: string;
    country: string;
    city: string | null;
    currency: string;
    income: number;
    expenses: number;
    profit: number;
  }>();

  for (const office of offices) {
    officeBreakdown.set(office.id, {
      officeId: office.id,
      officeName: office.officeName,
      country: office.country,
      city: office.city,
      currency: office.currency,
      income: 0,
      expenses: 0,
      profit: 0,
    });
  }

  for (const income of incomes as IncomeRecord[]) {
    const monthEntry = monthlyMap.get(income.month);
    if (monthEntry) {
      monthEntry.income += income.totalIncome;
      monthEntry.profit += income.totalIncome;
    }

    const countryKey = income.office?.country || "Unassigned";
    byCountry.set(countryKey, (byCountry.get(countryKey) || 0) + income.totalIncome);
    topIncomeSources.set("Student Commission", (topIncomeSources.get("Student Commission") || 0) + income.studentCommission);
    topIncomeSources.set("Application Fee", (topIncomeSources.get("Application Fee") || 0) + income.applicationFee);
    topIncomeSources.set("Service Charge", (topIncomeSources.get("Service Charge") || 0) + income.serviceCharge);

    if (income.office) {
      const officeEntry = officeBreakdown.get(income.office.id);
      if (officeEntry) {
        officeEntry.income += income.totalIncome;
        officeEntry.profit += income.totalIncome;
      }
    }
  }

  for (const expense of expenses as ExpenseRecord[]) {
    summary.totalExpenses += expense.totalExpenses;
    if (expense.isCostOfSale) {
      summary.costOfSales += expense.totalExpenses;
    } else {
      summary.operatingExpenses += expense.totalExpenses;
    }

    const monthEntry = monthlyMap.get(expense.month);
    if (monthEntry) {
      monthEntry.expenses += expense.totalExpenses;
      monthEntry.profit -= expense.totalExpenses;
    }

    if (expense.office) {
      const officeEntry = officeBreakdown.get(expense.office.id);
      if (officeEntry) {
        officeEntry.expenses += expense.totalExpenses;
        officeEntry.profit -= expense.totalExpenses;
      }
    }

    expenseByCategory.set("Rent", (expenseByCategory.get("Rent") || 0) + expense.rent);
    expenseByCategory.set("Salaries", (expenseByCategory.get("Salaries") || 0) + expense.salaries);
    expenseByCategory.set("Marketing", (expenseByCategory.get("Marketing") || 0) + expense.marketing);
    expenseByCategory.set("Operations", (expenseByCategory.get("Operations") || 0) + expense.operations);
    expenseByCategory.set("Legal", (expenseByCategory.get("Legal") || 0) + expense.legal);
    expenseByCategory.set("Travel", (expenseByCategory.get("Travel") || 0) + expense.travel);
  }

  summary.totalIncome = incomeBreakdown.totals.finalTotal;
  if (filters.month) {
    const targetMonth = monthlyMap.get(filters.month);
    if (targetMonth) {
      targetMonth.income = incomeBreakdown.totals.finalTotal;
      targetMonth.profit = Number((targetMonth.income - targetMonth.expenses).toFixed(2));
    }
  }

  summary.netProfit = Number((summary.totalIncome - summary.totalExpenses).toFixed(2));
  summary.totalExpenses = Number(summary.totalExpenses.toFixed(2));
  summary.costOfSales = Number(summary.costOfSales.toFixed(2));
  summary.operatingExpenses = Number(summary.operatingExpenses.toFixed(2));
  summary.margin = summary.totalIncome > 0
    ? Number(((summary.netProfit / summary.totalIncome) * 100).toFixed(2))
    : 0;

  return {
    filters: {
      year: filters.year,
      month: filters.month,
      officeId: filters.officeId,
      subAgentId: scopedSubAgentId,
    },
    summary,
    monthlyTrend: Array.from(monthlyMap.values()).map((entry) => ({
      ...entry,
      income: Number(entry.income.toFixed(2)),
      expenses: Number(entry.expenses.toFixed(2)),
      profit: Number(entry.profit.toFixed(2)),
    })),
    incomeByCountry: Array.from(byCountry.entries())
      .map(([country, amount]) => ({ country, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount),
    topIncomeSources: incomeBreakdown.sourceRows
      .map((row) => ({ source: row.label, amount: row.finalAmount }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    expenseByCategory: Array.from(expenseByCategory.entries())
      .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount),
    officeBreakdown: Array.from(officeBreakdown.values())
      .map((entry) => ({
        ...entry,
        income: Number(entry.income.toFixed(2)),
        expenses: Number(entry.expenses.toFixed(2)),
        profit: Number(entry.profit.toFixed(2)),
      }))
      .sort((a, b) => b.profit - a.profit),
    offices,
    recentIncome: incomes.slice(0, 10),
    recentExpenses: expenses.slice(0, 10),
  };
}