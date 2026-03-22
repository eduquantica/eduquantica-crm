import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type SummaryPayload = {
  filters: {
    year: number;
    month: number | null;
    officeId: string | null;
    subAgentId: string | null;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    margin: number;
  };
  monthlyTrend: Array<{
    label: string;
    income: number;
    expenses: number;
    profit: number;
  }>;
  incomeByCountry: Array<{ country: string; amount: number }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export async function buildPLSummaryPdf(payload: SummaryPayload) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 94, width, height: 94, color: rgb(0.08, 0.2, 0.42) });
  page.drawText("EduQuantica Profit & Loss Report", {
    x: 24,
    y: height - 54,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    `Period: ${payload.filters.month ? `${String(payload.filters.month).padStart(2, "0")}/` : ""}${payload.filters.year}`,
    {
      x: 24,
      y: height - 74,
      size: 10,
      font: regular,
      color: rgb(0.87, 0.92, 1),
    },
  );

  let y = height - 128;
  const cards: Array<[string, string]> = [
    ["Total Income", money(payload.summary.totalIncome)],
    ["Total Expenses", money(payload.summary.totalExpenses)],
    ["Net Profit", money(payload.summary.netProfit)],
    ["Margin", `${payload.summary.margin.toFixed(2)}%`],
  ];

  for (const [label, value] of cards) {
    page.drawText(`${label}:`, { x: 28, y, size: 11, font: bold, color: rgb(0.17, 0.2, 0.26) });
    page.drawText(value, { x: 170, y, size: 11, font: regular, color: rgb(0.2, 0.25, 0.34) });
    y -= 20;
  }

  y -= 8;
  page.drawText("Monthly Trend", { x: 28, y, size: 12, font: bold, color: rgb(0.12, 0.18, 0.29) });
  y -= 18;

  for (const row of payload.monthlyTrend.slice(0, 10)) {
    page.drawText(row.label, { x: 32, y, size: 9, font: regular, color: rgb(0.25, 0.28, 0.35) });
    page.drawText(money(row.income), { x: 120, y, size: 9, font: regular, color: rgb(0.1, 0.47, 0.25) });
    page.drawText(money(row.expenses), { x: 245, y, size: 9, font: regular, color: rgb(0.72, 0.16, 0.16) });
    page.drawText(money(row.profit), { x: 370, y, size: 9, font: bold, color: rgb(0.11, 0.2, 0.36) });
    y -= 14;
  }

  y -= 10;
  page.drawText("Revenue by Country", { x: 28, y, size: 12, font: bold, color: rgb(0.12, 0.18, 0.29) });
  y -= 18;

  for (const row of payload.incomeByCountry.slice(0, 8)) {
    page.drawText(row.country, { x: 32, y, size: 9, font: regular, color: rgb(0.25, 0.28, 0.35) });
    page.drawText(money(row.amount), { x: 260, y, size: 9, font: regular, color: rgb(0.11, 0.2, 0.36) });
    y -= 13;
  }

  return Buffer.from(await pdf.save());
}
