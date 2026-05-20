import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_FINANCIAL_REQUIREMENTS, normalizeCountryCode } from "@/lib/financial-requirements";

export const dynamic = "force-dynamic";

// Returns merged living cost data (defaults + DB overrides).
// Accessible to any authenticated user (staff and students).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rows = await db.livingCostCountry.findMany({
    select: {
      countryCode: true,
      countryName: true,
      monthlyLivingCost: true,
      currency: true,
      defaultMonths: true,
    },
  });

  const map = new Map(
    DEFAULT_FINANCIAL_REQUIREMENTS.map((r) => [normalizeCountryCode(r.countryCode), r]),
  );

  for (const row of rows) {
    const code = normalizeCountryCode(row.countryCode);
    map.set(code, {
      countryCode: code,
      countryName: row.countryName,
      monthlyLivingCost: Number(row.monthlyLivingCost),
      currency: String(row.currency).toUpperCase(),
      defaultMonths: Number(row.defaultMonths),
      rules: [],
    });
  }

  const data = Array.from(map.values()).map((r) => ({
    countryCode: r.countryCode,
    countryName: r.countryName,
    monthlyLivingCost: r.monthlyLivingCost,
    defaultMonths: r.defaultMonths,
    annualLivingCost: r.monthlyLivingCost * r.defaultMonths,
    currency: r.currency,
  }));

  return NextResponse.json({ data });
}
