import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { receiptUrl, receiptFileName, paidAt, notes } = body;

    const invoice = await db.studentInvoice.update({
      where: { id: params.invoiceId },
      data: {
        receiptUrl: receiptUrl || null,
        receiptFileName: receiptFileName || null,
        status: "PAID",
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        paidBy: session.user.id,
        notes: notes || null,
      },
    });

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error("[POST /api/students/[id]/invoices/[invoiceId]/receipt]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
