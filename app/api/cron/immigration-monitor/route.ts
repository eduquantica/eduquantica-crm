import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runImmigrationMonitoringBatch } from "@/lib/immigration-monitor";

export async function GET(req: Request) {
  const secret =
    req.headers.get("CRON_SECRET") ||
    req.headers.get("cron_secret") ||
    req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runImmigrationMonitoringBatch();
    const actor =
      (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } })) ||
      (await db.user.findFirst({ select: { id: true } }));

    if (actor?.id) {
      await db.activityLog.create({
        data: {
          userId: actor.id,
          entityType: "cron",
          entityId: "immigration-monitor",
          action: "weekly_scan",
          details: JSON.stringify({
            schedule: "Monday 06:00 UTC",
            pagesScanned: results.length,
            changesDetected: results.filter((item) => item.changed).length,
            errors: results.filter((item) => item.status === "error").length,
          }),
        },
      });
    }

    return NextResponse.json({
      data: {
        schedule: "Monday 06:00 UTC",
        pagesScanned: results.length,
        changesDetected: results.filter((item) => item.changed).length,
        results,
      },
    });
  } catch (error) {
    console.error("immigration-monitor cron failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
