import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const baseCurrency = (
      request.nextUrl.searchParams.get("from") ||
      request.nextUrl.searchParams.get("baseCurrency") ||
      ""
    ).toUpperCase();
    const targetCurrency = (
      request.nextUrl.searchParams.get("to") ||
      request.nextUrl.searchParams.get("targetCurrency") ||
      ""
    ).toUpperCase();

    if (!baseCurrency || !targetCurrency) {
      return NextResponse.json({ error: "baseCurrency and targetCurrency are required" }, { status: 400 });
    }

    const row = await db.currencyRate.findUnique({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency,
          targetCurrency,
        },
      },
      select: {
        rate: true,
        fetchedAt: true,
        source: true,
      },
    });

    return NextResponse.json({
      data: {
        rate: row?.rate ?? null,
        updatedAt: row?.fetchedAt?.toISOString() ?? null,
        source: row?.source ?? null,
      },
    });
  } catch (error) {
    console.error("[/api/currency/rate GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
