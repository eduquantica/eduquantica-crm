import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ServicePayStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";

// SERVICE PAYMENTS - NO COMMISSION
// These payments go directly to
// EduQuantica only.
// Do NOT link to Commission model.
// Do NOT calculate sub-agent commission.

const updateSchema = z.object({
  status: z.nativeEnum(ServicePayStatus).optional(),
  confirmedBy: z.string().trim().optional().nullable(),
  rejectionReason: z.string().trim().optional().nullable(),
  action: z.enum(["GENERATE_INVOICE"]).optional(),
});

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

async function ensureInvoicesDir() {
  const dir = path.join(process.cwd(), "storage", "uploads", "service-invoices");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function safeName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function buildInvoicePdf(args: {
  invoiceNumber: string;
  studentName: string;
  studentEmail: string;
  description: string;
  amount: number;
  currency: string;
  confirmedDate: Date;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  let y = 800;
  page.drawRectangle({ x: 32, y: y - 18, width: 48, height: 20, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("EQ", { x: 48, y: y - 6, size: 10, font: bold, color: rgb(1, 1, 1) });
  page.drawText("EduQuantica", { x: 90, y, size: 18, font: bold, color: rgb(0.12, 0.31, 0.56) });
  page.drawText("SERVICE INVOICE", { x: 380, y, size: 12, font: bold });

  y -= 44;
  page.drawText(`Invoice Number: ${args.invoiceNumber}`, { x: 32, y, size: 11, font: bold });
  y -= 18;
  page.drawText(`Date Confirmed: ${args.confirmedDate.toLocaleDateString("en-GB")}`, { x: 32, y, size: 10, font: regular });

  y -= 34;
  page.drawText("Student", { x: 32, y, size: 11, font: bold });
  y -= 18;
  page.drawText(args.studentName, { x: 32, y, size: 10, font: regular });
  y -= 16;
  page.drawText(args.studentEmail || "-", { x: 32, y, size: 10, font: regular });

  y -= 32;
  page.drawText("Service Description", { x: 32, y, size: 11, font: bold });
  y -= 18;
  page.drawText(args.description, { x: 32, y, size: 10, font: regular });

  y -= 36;
  page.drawLine({ start: { x: 32, y }, end: { x: 563, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 22;
  page.drawText("Amount Paid", { x: 32, y, size: 11, font: bold });
  page.drawText(`${args.currency} ${args.amount.toFixed(2)}`, { x: 450, y, size: 11, font: bold });

  return pdf.save();
}

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  return `INV-SRV-${year}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const payment = await db.servicePayment.findUnique({ where: { id: params.id } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const student = await db.student.findUnique({
      where: { id: payment.studentId },
      select: { userId: true, firstName: true, lastName: true, email: true },
    });

    const booking = await db.airportPickupBooking.findUnique({
      where: { id: payment.referenceId },
      select: { airport: true, arrivalDate: true, arrivalTime: true },
    });

    if (parsed.data.action === "GENERATE_INVOICE") {
      const confirmedAt = payment.paidAt || new Date();
      const invoiceNumber = payment.invoiceNumber || await generateInvoiceNumber();
      const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : payment.studentId;

      const bytes = await buildInvoicePdf({
        invoiceNumber,
        studentName,
        studentEmail: student?.email || "",
        description: payment.description,
        amount: payment.amount,
        currency: payment.currency,
        confirmedDate: confirmedAt,
      });

      const dir = await ensureInvoicesDir();
      const fileName = safeName(`${invoiceNumber}.pdf`);
      const fullPath = path.join(dir, fileName);
      await fs.writeFile(fullPath, Buffer.from(bytes));

      const invoiceUrl = `/api/files/service-invoices/${encodeURIComponent(fileName)}`;
      const updated = await db.servicePayment.update({
        where: { id: payment.id },
        data: { invoiceNumber, invoiceUrl },
      });

      return NextResponse.json({ data: updated });
    }

    if (!parsed.data.status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const nextStatus = parsed.data.status;
    if (nextStatus !== ServicePayStatus.CONFIRMED && nextStatus !== ServicePayStatus.REJECTED) {
      return NextResponse.json({ error: "Only CONFIRMED or REJECTED can be set here" }, { status: 400 });
    }

    const updated = await db.servicePayment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        confirmedBy: nextStatus === ServicePayStatus.CONFIRMED
          ? (parsed.data.confirmedBy || session.user.id)
          : payment.confirmedBy,
        paidAt: nextStatus === ServicePayStatus.CONFIRMED ? new Date() : null,
        rejectionReason: nextStatus === ServicePayStatus.REJECTED ? (parsed.data.rejectionReason || "Not provided") : null,
      },
    });

    if (student?.userId) {
      if (nextStatus === ServicePayStatus.CONFIRMED) {
        const arrivalDateLabel = booking?.arrivalDate ? booking.arrivalDate.toISOString().split("T")[0] : "-";
        await NotificationService.createNotification({
          userId: student.userId,
          type: "SERVICE_PAYMENT_CONFIRMED",
          message: `Your payment of ${updated.currency}${updated.amount} has been confirmed. Booking reference: ${updated.referenceId.slice(-8).toUpperCase()}.`,
          linkUrl: "/student/services",
          actorUserId: session.user.id,
        }).catch(() => undefined);

        if (student.email) {
          await sendResendEmail({
            to: student.email,
            subject: "Payment Confirmed - Airport Pickup Booked",
            html: `<p>Dear ${student.firstName} ${student.lastName},</p><p>Your payment of ${updated.currency}${updated.amount} has been confirmed.</p><p>Booking reference: ${updated.referenceId.slice(-8).toUpperCase()}</p><p>Someone will meet you at ${booking?.airport || "the selected airport"} on ${arrivalDateLabel} at ${booking?.arrivalTime || "-"}.</p>`,
          }).catch(() => undefined);
        }
      }

      if (nextStatus === ServicePayStatus.REJECTED) {
        const reason = updated.rejectionReason || "Not provided";
        await NotificationService.createNotification({
          userId: student.userId,
          type: "SERVICE_PAYMENT_REJECTED",
          message: `Your payment could not be verified. Reason: ${reason}. Please resubmit or contact info@eduquantica.com`,
          linkUrl: "/student/services",
          actorUserId: session.user.id,
        }).catch(() => undefined);

        if (student.email) {
          await sendResendEmail({
            to: student.email,
            subject: "Payment Verification Failed",
            html: `<p>Dear ${student.firstName} ${student.lastName},</p><p>We could not verify your payment.</p><p>Reason: ${reason}</p><p>Please resubmit or contact info@eduquantica.com</p>`,
          }).catch(() => undefined);
        }
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/service-payments/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
