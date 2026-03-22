import { NextRequest, NextResponse } from "next/server";
import { canViewPL, getPLScope, getPLSummary, parsePLFilters } from "@/lib/pl";
import { buildPLSummaryPdf } from "@/lib/pl-pdf";

function toCsv(data: Awaited<ReturnType<typeof getPLSummary>>) {
  const lines = [
    "Metric,Value",
    `Total Income,${data.summary.totalIncome}`,
    `Total Expenses,${data.summary.totalExpenses}`,
    `Net Profit,${data.summary.netProfit}`,
    `Margin,${data.summary.margin}`,
    "",
    "Month,Income,Expenses,Profit",
    ...data.monthlyTrend.map((row) => `${row.label},${row.income},${row.expenses},${row.profit}`),
    "",
    "Country,Income",
    ...data.incomeByCountry.map((row) => `${row.country},${row.amount}`),
  ];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  const filters = parsePLFilters(req.nextUrl.searchParams);
  const data = await getPLSummary(scope, filters);

  if (format === "pdf") {
    const bytes = await buildPLSummaryPdf(data);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=pl-summary-${filters.year}-${filters.month || "all"}.pdf`,
      },
    });
  }

  const csv = toCsv(data);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=pl-summary-${filters.year}-${filters.month || "all"}.csv`,
    },
  });
}
