import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import calculateProfileCompletion from "@/lib/profile-completion";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const students = await db.student.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // compute profile completion
    const enriched = await Promise.all(
      students.map(async (s) => {
        const pct = await calculateProfileCompletion(s.id);
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          subAgentId: s.subAgentId,
          preferredCurrency: s.preferredCurrency,
          profileCompletion: pct,
        };
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
