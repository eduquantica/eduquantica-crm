import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureTestAccountsExist } from "@/lib/test-accounts";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await db.$queryRaw`SELECT 1`;

    let adminExists = Boolean(
      await db.user.findUnique({
        where: { email: "admin@eduquantica.com" },
        select: { id: true },
      }),
    );

    if (!adminExists) {
      await ensureTestAccountsExist();
      adminExists = Boolean(
        await db.user.findUnique({
          where: { email: "admin@eduquantica.com" },
          select: { id: true },
        }),
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      adminExists,
      timestamp,
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        adminExists: false,
        timestamp,
      },
      { status: 500 },
    );
  }
}
