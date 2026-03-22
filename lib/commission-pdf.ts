import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type StatementLine = {
  student: string;
  university: string;
  course: string;
  intake: string;
  amount: number;
  status: string;
  currency: string;
};

export function parseStatementMonth(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    const value = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return { value, start, end };
  }

  const [year, mon] = month.split("-").map((v) => Number(v));
  if (!year || !mon || mon < 1 || mon > 12) {
    const now = new Date();
    const value = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return { value, start, end };
  }

  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
  return { value: month, start, end };
}

function periodLabel(month: string) {
  const [year, mon] = month.split("-").map((v) => Number(v));
  return new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function money(value: number, currency = "GBP") {
  return `${currency} ${value.toFixed(2)}`;
}

export async function generateCommissionStatementPdf(args: {
  agencyName: string;
  details: string[];
  month: string;
  lines: StatementLine[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([842, 595]);
  const { height } = page.getSize();

  page.drawRectangle({ x: 32, y: height - 66, width: 46, height: 22, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("EQ", { x: 47, y: height - 51, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText("EduQuantica", { x: 86, y: height - 52, size: 18, font: bold, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("Sub-Agent Commission Statement", { x: 590, y: height - 52, size: 12, font: bold });

  page.drawText(`Agency: ${args.agencyName}`, { x: 32, y: height - 90, size: 10, font: bold });
  page.drawText(`Statement Period: ${periodLabel(args.month)}`, { x: 32, y: height - 106, size: 10, font: regular });
  page.drawText(`Generated: ${new Date().toLocaleString("en-GB")}`, { x: 32, y: height - 122, size: 9, font: regular });

  let detailsY = height - 90;
  for (const detail of args.details.slice(0, 4)) {
    page.drawText(detail, { x: 510, y: detailsY, size: 9, font: regular });
    detailsY -= 14;
  }

  const tableTop = height - 160;
  page.drawRectangle({ x: 32, y: tableTop, width: 778, height: 18, color: rgb(0.94, 0.95, 0.97) });
  page.drawText("Student", { x: 36, y: tableTop + 5, size: 8.5, font: bold });
  page.drawText("University", { x: 150, y: tableTop + 5, size: 8.5, font: bold });
  page.drawText("Course", { x: 315, y: tableTop + 5, size: 8.5, font: bold });
  page.drawText("Intake", { x: 530, y: tableTop + 5, size: 8.5, font: bold });
  page.drawText("Amount", { x: 610, y: tableTop + 5, size: 8.5, font: bold });
  page.drawText("Status", { x: 710, y: tableTop + 5, size: 8.5, font: bold });

  let y = tableTop - 14;
  for (const line of args.lines.slice(0, 20)) {
    page.drawText(line.student.slice(0, 20), { x: 36, y, size: 8, font: regular });
    page.drawText(line.university.slice(0, 24), { x: 150, y, size: 8, font: regular });
    page.drawText(line.course.slice(0, 30), { x: 315, y, size: 8, font: regular });
    page.drawText(line.intake.slice(0, 12), { x: 530, y, size: 8, font: regular });
    page.drawText(money(line.amount, line.currency), { x: 610, y, size: 8, font: regular });
    page.drawText(line.status.slice(0, 16), { x: 710, y, size: 8, font: regular });
    y -= 14;
  }

  const total = args.lines.reduce((sum, line) => sum + line.amount, 0);
  page.drawLine({ start: { x: 560, y: y - 2 }, end: { x: 810, y: y - 2 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  page.drawText("Total (Sub-agent portion)", { x: 560, y: y - 18, size: 10, font: bold });
  page.drawText(money(total, args.lines[0]?.currency || "GBP"), { x: 720, y: y - 18, size: 10, font: bold });

  page.drawText("Note: amounts shown are sub-agent portion only.", {
    x: 32,
    y: 24,
    size: 9,
    font: regular,
    color: rgb(0.3, 0.3, 0.3),
  });

  return Buffer.from(await pdf.save());
}

export async function generateCommissionReceiptPdf(args: {
  commissionId: string;
  agencyName: string;
  student: string;
  university: string;
  course: string;
  intake: string;
  grossCommission: number;
  agentRate: number;
  agentAmount: number;
  netAmount: number;
  currency: string;
  status: string;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([595, 842]);
  const { height } = page.getSize();

  page.drawText("EduQuantica", { x: 42, y: height - 52, size: 20, font: bold, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("Commission Receipt", { x: 390, y: height - 52, size: 14, font: bold });

  const lines: Array<[string, string]> = [
    ["Receipt ID", args.commissionId],
    ["Generated", new Date().toLocaleString("en-GB")],
    ["Agency", args.agencyName],
    ["Student", args.student],
    ["University", args.university],
    ["Course", args.course],
    ["Intake", args.intake],
    ["Status", args.status],
    ["Gross Commission", money(args.grossCommission, args.currency)],
    ["Agent Rate", `${args.agentRate.toFixed(2)}%`],
    ["Sub-agent Amount", money(args.agentAmount, args.currency)],
    ["EduQuantica Net", money(args.netAmount, args.currency)],
  ];

  let y = height - 96;
  for (const [label, value] of lines) {
    page.drawText(label, { x: 42, y, size: 10, font: bold });
    page.drawText(value, { x: 210, y, size: 10, font: regular });
    y -= 28;
  }

  return Buffer.from(await pdf.save());
}
