import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateCommissionStatementPdf, parseStatementMonth } from "@/lib/commission-pdf";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = parseStatementMonth(req.nextUrl.searchParams.get("month"));

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      agencyName: true,
      agencyCountry: true,
      agencyCity: true,
      businessEmail: true,
      phone: true,
      user: { select: { email: true } },
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const commissions = await db.commission.findMany({
    where: {
      subAgentId: subAgent.id,
      createdAt: { gte: period.start, lt: period.end },
    },
    select: {
      agentAmount: true,
      currency: true,
      status: true,
      application: {
        select: {
          createdAt: true,
          student: { select: { firstName: true, lastName: true } },
          course: { select: { name: true, university: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pdf = await generateCommissionStatementPdf({
    agencyName: subAgent.agencyName,
    details: [
      `Agency: ${subAgent.agencyName}`,
      `Email: ${subAgent.businessEmail || subAgent.user.email}`,
      `Phone: ${subAgent.phone || "-"}`,
      `Location: ${subAgent.agencyCity || ""}${subAgent.agencyCity && subAgent.agencyCountry ? ", " : ""}${subAgent.agencyCountry || "-"}`,
    ],
    month: period.value,
    lines: commissions.map((row) => ({
      student: `${row.application.student.firstName} ${row.application.student.lastName}`.trim(),
      university: row.application.course.university.name,
      course: row.application.course.name,
      intake: row.application.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      amount: row.agentAmount || 0,
      status: row.status,
      currency: row.currency,
    })),
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="commission-statement-${period.value}.pdf"`,
    },
  });
}
