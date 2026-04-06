import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.roleName;
    if (!["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoiceRecord = await db.studentInvoice.findUnique({
      where: { id: params.invoiceId },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!invoiceRecord || invoiceRecord.studentId !== params.id) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      action,
      reason,
      fileOpeningCharge,
      serviceCharge,
      serviceChargeType,
      serviceInstalment1,
      serviceInstalment1Desc,
      serviceInstalment2,
      serviceInstalment2Desc,
      ucasFee,
      applicationFee,
      applicationFeeDesc,
      applicationFee2,
      applicationFee2Desc,
      airportPickupFee,
      airportPickupDesc,
      otherDescription,
      otherAmount,
      currency,
      paymentMethod,
      notes,
      status,
      paidAt,
      paidBy,
    } = body;

    if (action === "CONFIRM_PAYMENT" || action === "REJECT_PAYMENT") {
      const canConfirmOrReject = ["ADMIN", "MANAGER", "COUNSELLOR"].includes(role);
      if (!canConfirmOrReject) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (action === "REJECT_PAYMENT" && !String(reason || "").trim()) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
      }

      const invoice = await db.studentInvoice.update({
        where: { id: params.invoiceId },
        data: action === "CONFIRM_PAYMENT"
          ? {
              status: "PAID",
              paidAt: new Date(),
              paidBy: session.user.id,
            }
          : {
              status: "DUE",
              paidAt: null,
              paidBy: null,
              notes: `Payment rejected: ${String(reason).trim()}`,
            },
      });

      if (invoiceRecord.student.userId) {
        await NotificationService.createNotification({
          userId: invoiceRecord.student.userId,
          type: action === "CONFIRM_PAYMENT" ? "INVOICE_PAYMENT_CONFIRMED" : "INVOICE_PAYMENT_REJECTED",
          message: action === "CONFIRM_PAYMENT"
            ? `Your payment for ${invoiceRecord.invoiceNumber} has been confirmed. Thank you.`
            : `Your receipt for ${invoiceRecord.invoiceNumber} was rejected. Please review and re-upload.`,
          linkUrl: "/student/payments",
        });
      }

      return NextResponse.json({ data: invoice });
    }

    // Calculate total
    let totalAmount = 0;
    if (fileOpeningCharge) totalAmount += fileOpeningCharge;
    if (serviceCharge) totalAmount += serviceCharge;
    if (serviceInstalment1) totalAmount += serviceInstalment1;
    if (serviceInstalment2) totalAmount += serviceInstalment2;
    if (ucasFee) totalAmount += ucasFee;
    if (applicationFee) totalAmount += applicationFee;
    if (applicationFee2) totalAmount += applicationFee2;
    if (airportPickupFee) totalAmount += airportPickupFee;
    if (otherAmount) totalAmount += otherAmount;

    const invoice = await db.studentInvoice.update({
      where: { id: params.invoiceId },
      data: {
        fileOpeningCharge: fileOpeningCharge !== undefined ? fileOpeningCharge : undefined,
        serviceCharge: serviceCharge !== undefined ? serviceCharge : undefined,
        serviceChargeType: serviceChargeType !== undefined ? serviceChargeType : undefined,
        serviceInstalment1: serviceInstalment1 !== undefined ? serviceInstalment1 : undefined,
        serviceInstalment1Desc: serviceInstalment1Desc !== undefined ? serviceInstalment1Desc : undefined,
        serviceInstalment2: serviceInstalment2 !== undefined ? serviceInstalment2 : undefined,
        serviceInstalment2Desc: serviceInstalment2Desc !== undefined ? serviceInstalment2Desc : undefined,
        ucasFee: ucasFee !== undefined ? ucasFee : undefined,
        applicationFee: applicationFee !== undefined ? applicationFee : undefined,
        applicationFeeDesc: applicationFeeDesc !== undefined ? applicationFeeDesc : undefined,
        applicationFee2: applicationFee2 !== undefined ? applicationFee2 : undefined,
        applicationFee2Desc: applicationFee2Desc !== undefined ? applicationFee2Desc : undefined,
        airportPickupFee: airportPickupFee !== undefined ? airportPickupFee : undefined,
        airportPickupDesc: airportPickupDesc !== undefined ? airportPickupDesc : undefined,
        otherDescription: otherDescription !== undefined ? otherDescription : undefined,
        otherAmount: otherAmount !== undefined ? otherAmount : undefined,
        totalAmount: totalAmount > 0 ? totalAmount : undefined,
        currency: currency !== undefined ? currency : undefined,
        paymentMethod: paymentMethod !== undefined ? paymentMethod : undefined,
        notes: notes !== undefined ? notes : undefined,
        status: status !== undefined ? status : undefined,
        paidAt: paidAt ? new Date(paidAt) : undefined,
        paidBy: paidBy !== undefined ? paidBy : undefined,
      },
    });

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error("[PATCH /api/students/[id]/invoices/[invoiceId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.roleName;
    // Only Admin, Manager, Sub-Agent, Branch Manager can delete
    if (!["ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.studentInvoice.delete({
      where: { id: params.invoiceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/students/[id]/invoices/[invoiceId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
