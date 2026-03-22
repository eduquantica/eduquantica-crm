import { NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { getSubAgentTierSnapshot } from "@/lib/subagent-tier";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getSubAgentTierSnapshot(scope.subAgentId);
  if (!snapshot) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const currentTier = snapshot.subAgent.tier;
  const nextTierText = !currentTier
    ? `No tier yet. Reach 80% KPI achievement to unlock SILVER.`
    : snapshot.nextTier
      ? `You are at ${currentTier}. Reach ${snapshot.nextTarget}% to unlock ${snapshot.nextTier}.`
      : `You are at ${currentTier}. You are already at the highest tier.`;

  return NextResponse.json({
    data: {
      currentTier,
      tierAchievedAt: snapshot.subAgent.tierAchievedAt,
      certificateIssuedAt: snapshot.subAgent.certificateIssuedAt,
      certificateUrl: snapshot.subAgent.certificateUrl,
      kpiAchievementPercentage: snapshot.achievementPct,
      nextTier: snapshot.nextTier,
      nextTarget: snapshot.nextTarget,
      nextTierText,
      colors: snapshot.colors,
      history: snapshot.history,
    },
  });
}
