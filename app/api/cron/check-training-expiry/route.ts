import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deriveTrainingStatus } from "@/lib/training";
import { sendTrainingExpiryNotifications } from "@/lib/training-notifications";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function GET(req: Request) {
  const secret =
    req.headers.get("CRON_SECRET") ||
    req.headers.get("cron_secret") ||
    req.headers.get("x-cron-secret");

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const records = await db.trainingRecord.findMany({
      where: {
        expiryDate: {
          lte: in30,
        },
        status: {
          in: ["ACTIVE", "EXPIRING_SOON"],
        },
      },
      select: {
        id: true,
        expiryDate: true,
        status: true,
      },
    });

    let expiringSoon = 0;
    let expired = 0;
    let notificationsSent = 0;

    for (const row of records) {
      const nextStatus = deriveTrainingStatus(row.expiryDate);
      if (nextStatus !== row.status) {
        await db.trainingRecord.update({
          where: { id: row.id },
          data: { status: nextStatus },
        });
      }

      if (nextStatus === "EXPIRING_SOON") expiringSoon += 1;
      if (nextStatus === "EXPIRED") expired += 1;

      const expiry = row.expiryDate;
      if (!expiry) continue;

      const thirtyDayTrigger = isSameDay(expiry, in30);
      const onExpiryTrigger = isSameDay(expiry, today);

      if (thirtyDayTrigger) {
        const result = await sendTrainingExpiryNotifications(row.id, "THIRTY_DAYS");
        if (result.sent) notificationsSent += 1;
      }

      if (onExpiryTrigger) {
        const result = await sendTrainingExpiryNotifications(row.id, "ON_EXPIRY");
        if (result.sent) notificationsSent += 1;
      }
    }

    return NextResponse.json({
      data: {
        scanned: records.length,
        expiringSoon,
        expired,
        notificationsSent,
      },
    });
  } catch (error) {
    console.error("check-training-expiry cron failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
