import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoices = await db.subAgentInvoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      currency: true,
      submittedAt: true,
      status: true,
      pdfUrl: true,
      adminNote: true,
      paymentRef: true,
      paidAt: true,
      subAgent: {
        select: {
          agencyName: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({ data: invoices });
}
