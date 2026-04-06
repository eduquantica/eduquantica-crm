import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoiceRecord = await db.studentInvoice.findUnique({
      where: { id: params.invoiceId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
          },
        },
      },
    });

    if (!invoiceRecord || invoiceRecord.studentId !== params.id) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const role = session.user.roleName;
    if (role === "STUDENT" && invoiceRecord.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { receiptUrl, receiptFileName, notes } = body as {
      receiptUrl?: string | null;
      receiptFileName?: string | null;
      notes?: string | null;
    };

    if (!receiptUrl) {
      return NextResponse.json({ error: "Receipt URL is required" }, { status: 400 });
    }

    const invoice = await db.studentInvoice.update({
      where: { id: params.invoiceId },
      data: {
        receiptUrl,
        receiptFileName: receiptFileName || null,
        status: "PROOF_UPLOADED",
        paidAt: null,
        paidBy: null,
        notes: notes || invoiceRecord.notes || null,
      },
    });

    const studentName = `${invoiceRecord.student.firstName} ${invoiceRecord.student.lastName}`.trim();
    const staffUsers = await db.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ["ADMIN", "MANAGER", "COUNSELLOR"] } },
      },
      select: { id: true },
    });

    await Promise.all(
      staffUsers
        .filter((user) => user.id !== session.user.id)
        .map((user) =>
          NotificationService.createNotification({
            userId: user.id,
            type: "INVOICE_RECEIPT_UPLOADED",
            message: `${studentName || "Student"} uploaded receipt for Invoice ${invoiceRecord.invoiceNumber}. Please verify.`,
            linkUrl: `/dashboard/students/${invoiceRecord.studentId}?tab=payments`,
          }),
        ),
    );

    return NextResponse.json({
      data: invoice,
      message: "Receipt uploaded. Awaiting staff confirmation.",
    });
  } catch (error) {
    console.error("[POST /api/students/[id]/invoices/[invoiceId]/receipt]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
