import { NextResponse } from "next/server";
import { runAllTriggers } from "@/lib/auto-tasks";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const secret =
    req.headers.get("CRON_SECRET") ||
    req.headers.get("cron_secret") ||
    req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const created = await runAllTriggers();

    // log activity, attribute to an admin user if possible
    const admin = await db.user.findFirst({
      where: { role: { name: "ADMIN" } },
      select: { id: true },
    });
    await db.activityLog.create({
      data: {
        userId: admin?.id || "",
        entityType: "cron",
        entityId: "auto-tasks",
        action: "auto_tasks_run",
        details: `created ${created} tasks`,
      },
    });

    return NextResponse.json({ data: { created } });
  } catch (err) {
    console.error("auto-tasks cron failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
