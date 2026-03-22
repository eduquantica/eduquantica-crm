import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// this route checks the session (headers) so it must run dynamically
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = {};

    if (status === "approved") {
      where = { isApproved: true };
    } else if (status === "pending") {
      where = { approvalStatus: "PENDING" };
    }

    const subAgents = await db.subAgent.findMany({
      where,
      select: {
        id: true,
        agencyName: true,
        isApproved: true,
        approvalStatus: true,
      },
      orderBy: { agencyName: "asc" },
    });

    return NextResponse.json({ data: { subAgents } });
  } catch (error) {
    console.error("[/api/admin/sub-agents GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
