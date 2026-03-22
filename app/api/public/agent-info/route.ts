import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const referralCode = req.nextUrl.searchParams.get("ref")?.trim();

  if (!referralCode) {
    return NextResponse.json({ agencyName: null });
  }

  const subAgent = await db.subAgent.findFirst({
    where: { referralCode },
    select: { agencyName: true },
  });

  return NextResponse.json({ agencyName: subAgent?.agencyName ?? null });
}
