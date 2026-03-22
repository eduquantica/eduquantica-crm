import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CommissionStatus, InvoiceStatus } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function monthRange(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, mon] = month.split("-").map((v) => Number(v));
  if (!year || !mon || mon < 1 || mon > 12) return null;
  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
  return { start, end };
}

function asCommissionStatus(value: string | null) {
  if (!value || value === "ALL") return null;
  if (Object.values(CommissionStatus).includes(value as CommissionStatus)) {
    return value as CommissionStatus;
  }
  return null;
}

function asInvoiceStatus(value: string | null) {
  if (!value || value === "ALL") return null;
  if (Object.values(InvoiceStatus).includes(value as InvoiceStatus)) {
    return value as InvoiceStatus;
  }
  return null;
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function buildPdf(title: string, headers: string[], rows: string[][]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([842, 595]);
  let y = 560;

  page.drawText(title, { x: 30, y, size: 14, font: bold });
  y -= 24;
  page.drawText(`Generated: ${new Date().toLocaleString("en-GB")}`, { x: 30, y, size: 9, font: regular });
  y -= 18;

  const line = headers.join(" | ");
  page.drawText(line, { x: 30, y, size: 8, font: bold });
  y -= 14;

  for (const row of rows) {
    if (y < 28) {
      page = pdf.addPage([842, 595]);
      y = 560;
      page.drawText(title, { x: 30, y, size: 14, font: bold });
      y -= 24;
      page.drawText(line, { x: 30, y, size: 8, font: bold });
      y -= 14;
    }

    const text = row.join(" | ").slice(0, 190);
    page.drawText(text, { x: 30, y, size: 8, font: regular });
    y -= 12;
  }

  return Buffer.from(await pdf.save());
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const tab = p.get("tab") || "all";
  const format = p.get("format") || "csv";
  const search = (p.get("search") || "").trim();
  const subAgentId = p.get("subAgentId") || "ALL";
  const commissionStatus = asCommissionStatus(p.get("commissionStatus"));
  const invoiceStatus = asInvoiceStatus(p.get("invoiceStatus"));
  const selectedMonth = monthRange(p.get("month"));

  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  if (tab === "invoices") {
    const rows = await db.subAgentInvoice.findMany({
      where: {
        ...(subAgentId !== "ALL" ? { subAgentId } : {}),
        ...(invoiceStatus ? { status: invoiceStatus } : {}),
        ...(selectedMonth ? { submittedAt: { gte: selectedMonth.start, lt: selectedMonth.end } } : {}),
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { subAgent: { agencyName: { contains: search, mode: "insensitive" } } },
                { subAgent: { user: { email: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        invoiceNumber: true,
        submittedAt: true,
        status: true,
        totalAmount: true,
        currency: true,
        paymentRef: true,
        subAgent: { select: { agencyName: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 1000,
    });

    const headers = ["Invoice", "Agency", "Amount", "Currency", "Status", "Submitted", "Payment Ref"];
    const bodyRows = rows.map((row) => [
      row.invoiceNumber,
      row.subAgent.agencyName,
      row.totalAmount.toFixed(2),
      row.currency,
      row.status,
      row.submittedAt.toLocaleDateString("en-GB"),
      row.paymentRef || "",
    ]);

    if (format === "csv") {
      const csv = [headers, ...bodyRows].map((line) => line.map(escapeCsv).join(",")).join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="commissions-invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const pdf = await buildPdf("Commissions Invoices Export", headers, bodyRows);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="commissions-invoices-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  }

  const isPending = tab === "pending";

  const rows = await db.commission.findMany({
    where: {
      ...(subAgentId !== "ALL" ? { subAgentId } : {}),
      ...(isPending ? { status: CommissionStatus.PENDING_ARRIVAL } : {}),
      ...(!isPending && commissionStatus ? { status: commissionStatus } : {}),
      ...(selectedMonth ? { createdAt: { gte: selectedMonth.start, lt: selectedMonth.end } } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: "insensitive" } },
              { application: { student: { firstName: { contains: search, mode: "insensitive" } } } },
              { application: { student: { lastName: { contains: search, mode: "insensitive" } } } },
              { application: { course: { name: { contains: search, mode: "insensitive" } } } },
              { application: { course: { university: { name: { contains: search, mode: "insensitive" } } } } },
              { subAgent: { agencyName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      currency: true,
      grossCommission: true,
      agentRateAtTime: true,
      agentAmount: true,
      visaApprovedAt: true,
      enrolmentConfirmedAt: true,
      application: {
        select: {
          student: { select: { firstName: true, lastName: true } },
          course: { select: { name: true, university: { select: { name: true } } } },
        },
      },
      subAgent: { select: { agencyName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const headers = isPending
    ? ["Commission ID", "Student", "Agency", "University", "Course", "Visa Approved", "Created"]
    : [
        "Commission ID",
        "Student",
        "Agency",
        "University",
        "Course",
        "Gross",
        "Agent Rate",
        "Agent Amount",
        "Currency",
        "Status",
        "Created",
      ];

  const bodyRows = rows.map((row) => {
    const studentName = `${row.application.student.firstName} ${row.application.student.lastName}`.trim();
    if (isPending) {
      return [
        row.id,
        studentName,
        row.subAgent?.agencyName || "-",
        row.application.course.university.name,
        row.application.course.name,
        row.visaApprovedAt ? row.visaApprovedAt.toLocaleDateString("en-GB") : "-",
        row.createdAt.toLocaleDateString("en-GB"),
      ];
    }

    return [
      row.id,
      studentName,
      row.subAgent?.agencyName || "-",
      row.application.course.university.name,
      row.application.course.name,
      (row.grossCommission ?? 0).toFixed(2),
      row.agentRateAtTime?.toFixed(2) || "-",
      row.agentAmount?.toFixed(2) || "0.00",
      row.currency,
      row.status,
      row.createdAt.toLocaleDateString("en-GB"),
    ];
  });

  if (format === "csv") {
    const csv = [headers, ...bodyRows].map((line) => line.map(escapeCsv).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="commissions-${tab}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const pdf = await buildPdf(
    isPending ? "Pending Arrival Commissions Export" : "All Commissions Export",
    headers,
    bodyRows,
  );
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="commissions-${tab}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
