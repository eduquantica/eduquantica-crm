import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CurrencyService } from "@/lib/currency";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await CurrencyService.refreshAllRates();

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "currency",
        entityId: "manual-refresh",
        action: "currency_rates_refreshed_manual",
        details: `Manually refreshed ${result.refreshedPairs} currency pairs`,
      },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[/api/admin/settings/currency/refresh POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
