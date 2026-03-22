import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const result = await db.mobileUploadSession.updateMany({
      where: {
        status: { in: ["PENDING", "UPLOADING"] },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return NextResponse.json({
      success: true,
      expiredCount: result.count,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[/api/cron/expire-mobile-sessions POST]", error);
    return NextResponse.json({ error: "Failed to expire mobile sessions" }, { status: 500 });
  }
}
