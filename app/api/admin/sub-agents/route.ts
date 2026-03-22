import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const TIER_LABEL: Record<string, "GOLD" | "SILVER" | "PLATINUM"> = {
  STANDARD: "GOLD",
  SILVER: "SILVER",
  PLATINUM: "PLATINUM",
};

function ensureStaffRole(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaffRole(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = (req.nextUrl.searchParams.get("status") || "").toUpperCase();
    const country = (req.nextUrl.searchParams.get("country") || "").trim();
    const tier = (req.nextUrl.searchParams.get("tier") || "").toUpperCase();

    const subAgents = await db.subAgent.findMany({
      where: {
        approvalStatus: "APPROVED",
        ...(status === "APPROVED" ? { isApproved: true } : {}),
        ...(status === "SUSPENDED" ? { isApproved: false } : {}),
        ...(country ? { agencyCountry: country } : {}),
        ...(tier
          ? {
              agreement: {
                currentTier:
                  tier === "GOLD" ? "STANDARD" : tier === "SILVER" ? "SILVER" : tier === "PLATINUM" ? "PLATINUM" : undefined,
              },
            }
          : {}),
      },
      select: {
        id: true,
        agencyName: true,
        firstName: true,
        lastName: true,
        agencyCountry: true,
        isApproved: true,
        commissionRate: true,
        user: { select: { name: true } },
        agreement: { select: { currentTier: true, currentRate: true } },
        _count: { select: { students: true } },
      },
      orderBy: { agencyName: "asc" },
    });

    const enrolmentsByAgent = await Promise.all(
      subAgents.map(async (agent) => {
        const count = await db.application.count({
          where: {
            status: "ENROLLED",
            student: { subAgentId: agent.id },
          },
        });
        return { id: agent.id, count };
      })
    );

    const enrolmentMap = new Map(enrolmentsByAgent.map((item) => [item.id, item.count]));

    const rows = subAgents.map((agent) => {
      const tierValue = agent.agreement?.currentTier || "STANDARD";
      const tierLabel = TIER_LABEL[tierValue] || "GOLD";
      const rate = Math.min(agent.agreement?.currentRate ?? agent.commissionRate ?? 80, 90);

      return {
        id: agent.id,
        agencyName: agent.agencyName,
        contactName: `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || agent.user.name || "-",
        country: agent.agencyCountry || "-",
        status: agent.isApproved ? "APPROVED" : "SUSPENDED",
        students: agent._count.students,
        enrolments: enrolmentMap.get(agent.id) || 0,
        tier: tierLabel,
        rate,
      };
    });

    const allApproved = await db.subAgent.findMany({
      where: { approvalStatus: "APPROVED" },
      select: {
        agencyCountry: true,
        agreement: { select: { currentTier: true } },
      },
    });

    const countries = Array.from(new Set(allApproved.map((a) => a.agencyCountry).filter(Boolean))) as string[];
    const tiers = Array.from(
      new Set(
        allApproved.map((a) => TIER_LABEL[a.agreement?.currentTier || "STANDARD"] || "GOLD")
      )
    ) as Array<"GOLD" | "SILVER" | "PLATINUM">;

    return NextResponse.json({ data: { rows, filters: { countries, tiers } } });
  } catch (error) {
    console.error("[/api/admin/sub-agents GET]", error);
    return NextResponse.json({ error: "Failed to load sub-agents", data: { rows: [], filters: { countries: [], tiers: [] } } }, { status: 500 });
  }
}
