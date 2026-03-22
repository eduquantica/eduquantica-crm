import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateCommissionReceiptPdf } from "@/lib/commission-pdf";

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commission = await db.commission.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      grossCommission: true,
      agentRateAtTime: true,
      agentAmount: true,
      eduquanticaNet: true,
      currency: true,
      status: true,
      application: {
        select: {
          createdAt: true,
          student: { select: { firstName: true, lastName: true } },
          course: { select: { name: true, university: { select: { name: true } } } },
        },
      },
      subAgent: { select: { agencyName: true } },
    },
  });

  if (!commission) {
    return NextResponse.json({ error: "Commission not found" }, { status: 404 });
  }

  const pdf = await generateCommissionReceiptPdf({
    commissionId: commission.id,
    agencyName: commission.subAgent?.agencyName || "-",
    student: `${commission.application.student.firstName} ${commission.application.student.lastName}`.trim(),
    university: commission.application.course.university.name,
    course: commission.application.course.name,
    intake: commission.application.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    grossCommission: commission.grossCommission,
    agentRate: commission.agentRateAtTime || 0,
    agentAmount: commission.agentAmount || 0,
    netAmount: commission.eduquanticaNet || 0,
    currency: commission.currency,
    status: commission.status,
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="commission-receipt-${commission.id}.pdf"`,
    },
  });
}
