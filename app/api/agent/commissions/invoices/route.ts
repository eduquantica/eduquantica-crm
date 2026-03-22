import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sendResendEmail } from "@/lib/resend";
import { UTApi } from "uploadthing/server";
import { NotificationService } from "@/lib/notifications";

const schema = z.object({
  commissionIds: z.array(z.string().min(1)).min(1),
  bankDetails: z.object({
    accountHolderName: z.string().min(1),
    bankName: z.string().min(1),
    accountNumber: z.string().min(1),
    sortCode: z.string().optional(),
    swiftOrIban: z.string().optional(),
    paypalEmail: z.string().email().optional().or(z.literal("")),
  }),
});

type InvoiceLine = {
  commissionId: string;
  studentName: string;
  university: string;
  course: string;
  intake: string;
  amount: number;
  currency: string;
};

function getAdminInboxEmail() {
  return process.env.ADMIN_INBOX_EMAIL || "admin@eduquantica.com";
}

async function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await db.subAgentInvoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  const current = latest?.invoiceNumber?.slice(prefix.length) || "0000";
  const next = String(Number(current) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

async function generateInvoicePdf(args: {
  invoiceNumber: string;
  agencyName: string;
  agencyAddress: string;
  submittedAt: Date;
  currency: string;
  lines: InvoiceLine[];
  total: number;
  bankDetails: z.infer<typeof schema>["bankDetails"];
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 30, y: height - 65, width: 42, height: 22, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("EQ", { x: 42, y: height - 50, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText("EduQuantica", { x: 80, y: height - 50, size: 18, font: bold, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("TAX INVOICE", { x: 640, y: height - 50, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });

  page.drawText(`Invoice Number: ${args.invoiceNumber}`, { x: 30, y: height - 88, size: 10, font: bold });
  page.drawText(`Date: ${args.submittedAt.toLocaleDateString("en-GB")}`, { x: 30, y: height - 104, size: 10, font });

  page.drawText("From:", { x: 30, y: height - 132, size: 11, font: bold });
  page.drawText(args.agencyName, { x: 30, y: height - 148, size: 10, font });
  page.drawText(args.agencyAddress, { x: 30, y: height - 162, size: 10, font });

  page.drawText("To:", { x: 360, y: height - 132, size: 11, font: bold });
  page.drawText("EduQuantica", { x: 360, y: height - 148, size: 10, font });
  page.drawText("London, United Kingdom", { x: 360, y: height - 162, size: 10, font });
  page.drawText("support@eduquantica.com", { x: 360, y: height - 176, size: 10, font });

  const tableY = height - 210;
  page.drawRectangle({ x: 30, y: tableY, width: 782, height: 18, color: rgb(0.94, 0.95, 0.97) });
  page.drawText("Student", { x: 34, y: tableY + 5, size: 9, font: bold });
  page.drawText("University", { x: 170, y: tableY + 5, size: 9, font: bold });
  page.drawText("Course", { x: 360, y: tableY + 5, size: 9, font: bold });
  page.drawText("Intake", { x: 610, y: tableY + 5, size: 9, font: bold });
  page.drawText("Amount", { x: 735, y: tableY + 5, size: 9, font: bold });

  let y = tableY - 14;
  for (const line of args.lines.slice(0, 14)) {
    page.drawText(line.studentName.slice(0, 22), { x: 34, y, size: 8.5, font });
    page.drawText(line.university.slice(0, 28), { x: 170, y, size: 8.5, font });
    page.drawText(line.course.slice(0, 32), { x: 360, y, size: 8.5, font });
    page.drawText(line.intake.slice(0, 14), { x: 610, y, size: 8.5, font });
    page.drawText(`${line.currency} ${line.amount.toFixed(2)}`, { x: 715, y, size: 8.5, font });
    y -= 15;
  }

  const totalY = y - 8;
  page.drawLine({ start: { x: 640, y: totalY + 18 }, end: { x: 812, y: totalY + 18 }, thickness: 1, color: rgb(0.65, 0.65, 0.65) });
  page.drawText("TOTAL", { x: 640, y: totalY, size: 11, font: bold });
  page.drawText(`${args.currency} ${args.total.toFixed(2)}`, { x: 735, y: totalY, size: 11, font: bold });

  const bankY = totalY - 44;
  page.drawText("Bank Details", { x: 30, y: bankY, size: 11, font: bold });
  page.drawText(`Account Holder: ${args.bankDetails.accountHolderName}`, { x: 30, y: bankY - 16, size: 9, font });
  page.drawText(`Bank: ${args.bankDetails.bankName}`, { x: 30, y: bankY - 30, size: 9, font });
  page.drawText(`Account Number: ${args.bankDetails.accountNumber}`, { x: 30, y: bankY - 44, size: 9, font });
  if (args.bankDetails.sortCode) {
    page.drawText(`Sort Code: ${args.bankDetails.sortCode}`, { x: 30, y: bankY - 58, size: 9, font });
  }
  if (args.bankDetails.swiftOrIban) {
    page.drawText(`SWIFT / IBAN: ${args.bankDetails.swiftOrIban}`, { x: 30, y: bankY - 72, size: 9, font });
  }
  if (args.bankDetails.paypalEmail) {
    page.drawText(`PayPal: ${args.bankDetails.paypalEmail}`, { x: 30, y: bankY - 86, size: 9, font });
  }

  page.drawText("Payment terms: Due within 30 days from invoice date.", {
    x: 30,
    y: 32,
    size: 9,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });

  return pdfDoc.save();
}

async function uploadPdfToUploadThing(fileName: string, bytes: Uint8Array) {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) {
    throw new Error("UPLOADTHING_TOKEN is required to upload invoice PDFs");
  }

  const utapi = new UTApi({ token });
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], fileName, { type: "application/pdf" });
  const uploaded = await utapi.uploadFiles(file);

  if (uploaded.error || !uploaded.data?.url) {
    throw new Error(uploaded.error?.message || "Failed to upload invoice PDF to UploadThing");
  }

  return uploaded.data.url;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { commissionIds, bankDetails } = parsed.data;

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      agencyName: true,
      agencyCountry: true,
      agencyCity: true,
      user: { select: { email: true } },
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const commissions = await db.commission.findMany({
    where: {
      id: { in: commissionIds },
      subAgentId: subAgent.id,
      status: "CALCULATED",
    },
    select: {
      id: true,
      agentAmount: true,
      currency: true,
      application: {
        select: {
          createdAt: true,
          student: { select: { firstName: true, lastName: true } },
          course: {
            select: {
              name: true,
              university: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (commissions.length !== commissionIds.length) {
    return NextResponse.json({ error: "Only CALCULATED commissions from your agency can be invoiced" }, { status: 400 });
  }

  const currency = commissions[0]?.currency || "GBP";
  const lineItems: InvoiceLine[] = commissions.map((commission) => ({
    commissionId: commission.id,
    studentName: `${commission.application.student.firstName} ${commission.application.student.lastName}`.trim(),
    university: commission.application.course.university.name,
    course: commission.application.course.name,
    intake: commission.application.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    amount: commission.agentAmount ?? 0,
    currency: commission.currency,
  }));

  const totalAmount = lineItems.reduce((sum, line) => sum + line.amount, 0);
  const invoiceNumber = await getNextInvoiceNumber();
  const submittedAt = new Date();

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber,
    agencyName: subAgent.agencyName,
    agencyAddress: `${subAgent.agencyCity || ""}${subAgent.agencyCity && subAgent.agencyCountry ? ", " : ""}${subAgent.agencyCountry || ""}` || "-",
    submittedAt,
    currency,
    lines: lineItems,
    total: totalAmount,
    bankDetails,
  });

  const pdfFileName = `${invoiceNumber}.pdf`;
  const pdfUrl = await uploadPdfToUploadThing(pdfFileName, pdfBytes);

  const bankDetailsPayload = {
    ...bankDetails,
    commissionIds,
    lineItems,
  };

  const invoice = await db.$transaction(async (tx) => {
    const created = await tx.subAgentInvoice.create({
      data: {
        invoiceNumber,
        subAgentId: subAgent.id,
        totalAmount,
        currency,
        pdfUrl,
        status: "SUBMITTED",
        submittedAt,
        bankDetails: JSON.stringify(bankDetailsPayload),
      },
    });

    await tx.commission.updateMany({
      where: { id: { in: commissionIds }, subAgentId: subAgent.id, status: "CALCULATED" },
      data: { status: "INVOICED" },
    });

    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "sub_agent_invoice",
        entityId: created.id,
        action: "submitted",
        details: `Submitted invoice ${invoiceNumber} for ${currency} ${totalAmount.toFixed(2)}`,
      },
    });

    const adminUsers = await tx.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "MANAGER"] } },
        isActive: true,
      },
      select: { id: true, email: true },
    });

    for (const admin of adminUsers) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          type: "COMMISSION_INVOICE_SUBMITTED",
          message: `New invoice ${invoiceNumber} submitted by ${subAgent.agencyName}.`,
          linkUrl: "/dashboard/commissions/invoices",
        },
      }).catch(() => undefined);

      await tx.activityLog.create({
        data: {
          userId: admin.id,
          entityType: "sub_agent_invoice",
          entityId: created.id,
          action: "new_invoice_submitted",
          details: `New invoice submitted by ${subAgent.agencyName} - ${currency} ${totalAmount.toFixed(2)}`,
        },
      });
    }

    return created;
  });

  if (subAgent.user.email) {
    try {
      await sendResendEmail({
        to: subAgent.user.email,
        subject: `Invoice submitted: ${invoiceNumber} - EduQuantica`,
        html: `<p>Your invoice <strong>${invoiceNumber}</strong> has been submitted successfully.</p><p>Total: <strong>${currency} ${totalAmount.toFixed(2)}</strong></p><p><a href="${pdfUrl}">Download PDF Invoice</a></p>`,
      });
    } catch (error) {
      console.error("Failed to send invoice email to sub-agent", error);
    }
  }

  await NotificationService.createNotification({
    userId: session.user.id,
    type: "INVOICE_SUBMITTED",
    message: `Invoice ${invoiceNumber} submitted successfully.`,
    linkUrl: "/agent/invoices",
    actorUserId: session.user.id,
  }).catch(() => undefined);

  try {
    await sendResendEmail({
      to: getAdminInboxEmail(),
      subject: `New invoice submitted by ${subAgent.agencyName} - ${currency} ${totalAmount.toFixed(2)}`,
      html: `<p>A new sub-agent invoice has been submitted.</p><p><strong>Agency:</strong> ${subAgent.agencyName}</p><p><strong>Invoice:</strong> ${invoiceNumber}</p><p><strong>Total:</strong> ${currency} ${totalAmount.toFixed(2)}</p><p><a href="${pdfUrl}">View PDF</a></p>`,
    });
  } catch (error) {
    console.error("Failed to send admin invoice notification email", error);
  }

  return NextResponse.json({
    data: {
      invoiceId: invoice.id,
      invoiceNumber,
      pdfUrl,
    },
  });
}
