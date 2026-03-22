import { db } from "@/lib/db";

type DateRange = {
  startDate: Date;
  endDate: Date;
  label: string;
};

export type FunnelScope = {
  leadWhere?: Record<string, unknown>;
  studentWhere?: Record<string, unknown>;
  applicationWhere?: Record<string, unknown>;
};

export type FunnelStage = {
  key:
    | "leads"
    | "students"
    | "applications"
    | "conditional_offers"
    | "unconditional_offers"
    | "cas_letters"
    | "visa_applications"
    | "visa_receipts"
    | "enrolments";
  name: string;
  count: number;
  conversionRate: number;
  dropOff: number;
  color: "green" | "amber" | "red";
};

export type FunnelComparisonRow = {
  stage: string;
  periodACount: number;
  periodBCount: number;
  change: number;
  changePct: number | null;
};

export type FunnelComparison = {
  periodALabel: string;
  periodBLabel: string;
  rows: FunnelComparisonRow[];
  bestPerformingStage: string;
  biggestDropOff: string;
  overallGrowthPct: number | null;
};

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function withRange(base: Record<string, unknown> | undefined, range: DateRange | null) {
  if (!range) return base || {};
  return {
    ...(base || {}),
    createdAt: {
      gte: range.startDate,
      lte: range.endDate,
    },
  };
}

function conversionColor(rate: number): "green" | "amber" | "red" {
  if (rate > 50) return "green";
  if (rate >= 25) return "amber";
  return "red";
}

export async function buildRecruitmentFunnel(args: {
  scope: FunnelScope;
  range?: DateRange | null;
}) {
  const range = args.range || null;
  const leadWhere = withRange(args.scope.leadWhere, range);
  const studentWhere = withRange(args.scope.studentWhere, range);
  const appBase = withRange(args.scope.applicationWhere, range);

  const [
    leads,
    students,
    applications,
    conditionalOffers,
    unconditionalOffers,
    casLetters,
    visaApplications,
    visaReceipts,
    enrolments,
  ] = await Promise.all([
    db.lead.count({ where: leadWhere }),
    db.student.count({ where: studentWhere }),
    db.application.count({ where: appBase }),
    db.application.count({ where: { ...appBase, status: "CONDITIONAL_OFFER" } }),
    db.application.count({ where: { ...appBase, status: "UNCONDITIONAL_OFFER" } }),
    db.application.count({ where: { ...appBase, status: "CAS_ISSUED" } }),
    db.application.count({ where: { ...appBase, status: "VISA_APPLIED" } }),
    db.application.count({
      where: {
        ...appBase,
        OR: [
          { visaReceiptDate: { not: null } },
          { visaApplicationRef: { not: null } },
        ],
      },
    }),
    db.application.count({ where: { ...appBase, status: "ENROLLED" } }),
  ]);

  const ordered = [
    { key: "leads", name: "Leads", count: leads },
    { key: "students", name: "Students", count: students },
    { key: "applications", name: "Applications", count: applications },
    { key: "conditional_offers", name: "Conditional Offers", count: conditionalOffers },
    { key: "unconditional_offers", name: "Unconditional Offers", count: unconditionalOffers },
    { key: "cas_letters", name: "CAS Letters", count: casLetters },
    { key: "visa_applications", name: "Visa Applications", count: visaApplications },
    { key: "visa_receipts", name: "Visa Receipts", count: visaReceipts },
    { key: "enrolments", name: "Enrolments", count: enrolments },
  ] as const;

  const stages: FunnelStage[] = ordered.map((stage, index) => {
    if (index === 0) {
      return {
        key: stage.key,
        name: stage.name,
        count: stage.count,
        conversionRate: 100,
        dropOff: 0,
        color: "green",
      };
    }

    const previous = ordered[index - 1].count;
    const rate = pct(stage.count, previous);

    return {
      key: stage.key,
      name: stage.name,
      count: stage.count,
      conversionRate: rate,
      dropOff: Math.max(previous - stage.count, 0),
      color: conversionColor(rate),
    };
  });

  const conversionRows = stages.slice(1);
  const bestPerformingStage = conversionRows.length
    ? conversionRows.reduce((best, row) => (row.conversionRate > best.conversionRate ? row : best), conversionRows[0])
    : null;
  const weakestStage = conversionRows.length
    ? conversionRows.reduce((weakest, row) => (row.conversionRate < weakest.conversionRate ? row : weakest), conversionRows[0])
    : null;

  return {
    stages,
    overallConversionRate: pct(enrolments, leads),
    bestPerformingStage: bestPerformingStage
      ? { stage: bestPerformingStage.name, fromPreviousRate: bestPerformingStage.conversionRate }
      : null,
    weakestStage: weakestStage
      ? { stage: weakestStage.name, fromPreviousRate: weakestStage.conversionRate }
      : null,
  };
}

function parseMonth(value: string): DateRange | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    startDate,
    endDate,
    label: startDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}

function parseQuarter(value: string): DateRange | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return {
    startDate,
    endDate,
    label: `Q${quarter} ${year}`,
  };
}

function parseYear(value: string): DateRange | null {
  const match = /^(\d{4})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  return {
    startDate,
    endDate,
    label: `${year}`,
  };
}

export function resolveCompareRange(type: string | null, value: string | null): DateRange | null {
  if (!type || !value) return null;
  if (type === "MONTH") return parseMonth(value);
  if (type === "QUARTER") return parseQuarter(value);
  if (type === "YEAR") return parseYear(value);
  return null;
}

export async function buildComparison(args: {
  scope: FunnelScope;
  periodA: DateRange;
  periodB: DateRange;
}): Promise<FunnelComparison> {
  const [a, b] = await Promise.all([
    buildRecruitmentFunnel({ scope: args.scope, range: args.periodA }),
    buildRecruitmentFunnel({ scope: args.scope, range: args.periodB }),
  ]);

  const rows: FunnelComparisonRow[] = a.stages.map((stage, index) => {
    const currentB = b.stages[index];
    const change = currentB.count - stage.count;
    return {
      stage: stage.name,
      periodACount: stage.count,
      periodBCount: currentB.count,
      change,
      changePct: stage.count > 0 ? Math.round((change / stage.count) * 10000) / 100 : null,
    };
  });

  const bestPerformingStage = rows
    .filter((row) => row.changePct != null)
    .sort((x, y) => (y.changePct as number) - (x.changePct as number))[0]?.stage || rows[0]?.stage || "-";

  const biggestDropOff = b.stages.slice(1).sort((x, y) => y.dropOff - x.dropOff)[0]?.name || "-";

  const enrolmentA = rows.find((row) => row.stage === "Enrolments");
  const overallGrowthPct = enrolmentA?.changePct ?? null;

  return {
    periodALabel: args.periodA.label,
    periodBLabel: args.periodB.label,
    rows,
    bestPerformingStage,
    biggestDropOff,
    overallGrowthPct,
  };
}
