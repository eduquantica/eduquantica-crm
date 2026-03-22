import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAgentScope } from "@/lib/agent-scope";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.roleName === "ADMIN";
  const allowedAgentRoles = ["SUB_AGENT", "BRANCH_MANAGER"];
  if (!isAdmin && !allowedAgentRoles.includes(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let subAgentId: string | null = null;
  if (isAdmin) {
    const byUser = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    subAgentId = byUser?.id || null;
  } else {
    const scope = await getAgentScope();
    subAgentId = scope?.subAgentId || null;
  }

  if (!subAgentId) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { id: subAgentId },
    select: {
      id: true,
      referralCode: true,
      brandingLogoUrl: true,
      brandingPrimaryColor: true,
      agencyName: true,
      brandingContactEmail: true,
      brandingContactPhone: true,
      brandingWebsite: true,
      agreement: { select: { currentTier: true } },
      _count: { select: { referredStudents: true } },
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const tierLabel =
    subAgent.agreement?.currentTier === "SILVER"
      ? "SILVER"
      : subAgent.agreement?.currentTier === "PLATINUM"
      ? "PLATINUM"
      : "GOLD";

  let referralCode = subAgent.referralCode;
  if (!referralCode) {
    referralCode = `AG${subAgent.id.slice(-6).toUpperCase()}`;
    try {
      await db.subAgent.update({ where: { id: subAgent.id }, data: { referralCode } });
    } catch {
      referralCode = `${referralCode}${Math.floor(Math.random() * 90 + 10)}`;
      await db.subAgent.update({ where: { id: subAgent.id }, data: { referralCode } });
    }
  }

  const materials = await db.marketingMaterial.findMany({
    where: {
      isActive: true,
      availableTiers: { has: tierLabel },
      OR: [{ subAgentOwnerId: null }, { subAgentOwnerId: subAgent.id }],
    },
    select: {
      id: true,
      name: true,
      type: true,
      fileUrl: true,
      thumbnailUrl: true,
      linkedUniversity: { select: { name: true } },
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({
    data: {
      subAgent,
      tierLabel,
      materials,
      referralLink: `${process.env.NEXTAUTH_URL || ""}/register?ref=${referralCode}`,
    },
  });
}
