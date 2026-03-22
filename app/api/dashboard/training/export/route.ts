import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function ensureTrainingViewer(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function toCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const organisation = searchParams.get("organisation") || "";
  const staffId = searchParams.get("staffId") || "";
  const status = searchParams.get("status") || "";

  const records = await db.trainingRecord.findMany({
    where: {
      ...(organisation ? { training: { organisationType: organisation } } : {}),
      ...(staffId ? { userId: staffId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      training: true,
      user: { include: { role: true } },
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
  });

  const header = [
    "Organisation",
    "Staff Name",
    "Staff Role",
    "Training Name",
    "Completion Date",
    "Expiry Date",
    "Status",
    "Delivered By",
    "Certificate URL",
  ];

  const lines = [header.join(",")];
  for (const row of records) {
    lines.push([
      toCsvCell(row.training.organisationType),
      toCsvCell(row.user.name || row.user.email),
      toCsvCell(row.user.role.label),
      toCsvCell(row.training.name),
      toCsvCell(row.completionDate.toISOString()),
      toCsvCell(row.expiryDate?.toISOString() || ""),
      toCsvCell(row.status),
      toCsvCell(row.training.deliveredBy || ""),
      toCsvCell(row.certificateUrl || ""),
    ].join(","));
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-register-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
