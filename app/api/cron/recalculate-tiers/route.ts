import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recalculateAllSubAgentTiers } from "@/lib/subagent-tier";

export async function GET(req: Request) {
  const secret =
    req.headers.get("CRON_SECRET") ||
    req.headers.get("cron_secret") ||
    req.headers.get("x-cron-secret");

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recalculateAllSubAgentTiers();

    const actor =
      (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } })) ||
      (await db.user.findFirst({ select: { id: true } }));

    if (actor?.id) {
      await db.activityLog.create({
        data: {
          userId: actor.id,
          entityType: "cron",
          entityId: "recalculate-tiers",
          action: "subagent_tiers_recalculated",
          details: `Processed ${result.processed}/${result.total}; changed=${result.changed}; upgraded=${result.upgraded}`,
        },
      });
    }

    return NextResponse.json({
      data: {
        schedule: "nightly",
        ...result,
      },
    });
  } catch (error) {
    console.error("recalculate-tiers cron failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
