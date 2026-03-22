import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CurrencyService } from "@/lib/currency";

export async function GET(req: Request) {
  const secret =
    req.headers.get("CRON_SECRET") ||
    req.headers.get("cron_secret") ||
    req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await CurrencyService.refreshAllRates();

    const actor =
      (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } })) ||
      (await db.user.findFirst({ select: { id: true } }));

    if (actor?.id) {
      await db.activityLog.create({
        data: {
          userId: actor.id,
          entityType: "cron",
          entityId: "currency-refresh",
          action: "currency_rates_refreshed",
          details: `Refreshed ${result.refreshedPairs} currency pairs at 06:00 UTC daily schedule`,
        },
      });
    }

    return NextResponse.json({
      data: {
        refreshedPairs: result.refreshedPairs,
        sourceSummary: result.sourceSummary,
        schedule: "6am UTC daily",
      },
    });
  } catch (error) {
    console.error("currency-refresh cron failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
