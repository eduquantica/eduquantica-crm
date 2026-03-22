import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rates = await db.currencyRate.findMany({
      orderBy: [{ baseCurrency: "asc" }, { targetCurrency: "asc" }],
      select: {
        id: true,
        baseCurrency: true,
        targetCurrency: true,
        rate: true,
        source: true,
        fetchedAt: true,
      },
    });

    const latest = rates.reduce<{ fetchedAt: Date | null; source: string | null }>(
      (acc, row) => {
        if (!acc.fetchedAt || row.fetchedAt > acc.fetchedAt) {
          return { fetchedAt: row.fetchedAt, source: row.source || null };
        }
        return acc;
      },
      { fetchedAt: null, source: null },
    );

    return NextResponse.json({
      data: {
        lastRefreshAt: latest.fetchedAt?.toISOString() || null,
        source: latest.source,
        rates: rates.map((row) => ({
          id: row.id,
          baseCurrency: row.baseCurrency,
          targetCurrency: row.targetCurrency,
          rate: row.rate,
          source: row.source,
          updatedAt: row.fetchedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[/api/admin/settings/currency GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
