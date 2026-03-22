import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const invoices = await db.subAgentInvoice.findMany({
    where: { subAgentId: subAgent.id },
    select: {
      id: true,
      invoiceNumber: true,
      submittedAt: true,
      totalAmount: true,
      currency: true,
      status: true,
      pdfUrl: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({ data: invoices });
}
