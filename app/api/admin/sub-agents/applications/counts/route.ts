import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubAgentApprovalStatus } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const counts = await db.subAgent.groupBy({
    by: ["approvalStatus"],
    _count: { _all: true },
  });

  // Build a complete map with 0 as the default for statuses with no records
  const result: Record<string, number> = {
    [SubAgentApprovalStatus.PENDING]: 0,
    [SubAgentApprovalStatus.INFO_REQUESTED]: 0,
    [SubAgentApprovalStatus.APPROVED]: 0,
    [SubAgentApprovalStatus.REJECTED]: 0,
  };

  let total = 0;
  for (const row of counts) {
    result[row.approvalStatus] = row._count._all;
    total += row._count._all;
  }

  return NextResponse.json({ ...result, total });
}
