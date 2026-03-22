import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_FINANCIAL_REQUIREMENTS,
  normalizeCountryCode,
  type FinancialRequirementRule,
} from "@/lib/financial-requirements";

export const dynamic = 'force-dynamic';

const READ_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

const ruleSchema = z.object({
  countryCode: z.string().min(2),
  countryName: z.string().min(2),
  monthlyLivingCost: z.number().min(0),
  currency: z.string().min(3).max(3),
  defaultMonths: z.number().int().min(1).max(36),
  rules: z.array(z.string().min(2)).min(1),
});

const payloadSchema = z.object({
  rules: z.array(ruleSchema).min(1),
});

function mergeRules(
  rows: FinancialRequirementRule[],
  overrides: FinancialRequirementRule[],
  updatedMap: Map<string, string>,
) {
  const map = new Map(rows.map((row) => [row.countryCode, row]));
  for (const override of overrides) {
    map.set(override.countryCode, override);
  }
  return Array.from(map.values())
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode))
    .map((row) => ({
      ...row,
      lastUpdated: updatedMap.get(row.countryCode) || null,
    }));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !READ_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.livingCostCountry.findMany({
      orderBy: { countryCode: "asc" },
      select: {
        countryCode: true,
        countryName: true,
        monthlyLivingCost: true,
        currency: true,
        defaultMonths: true,
        rulesJson: true,
        updatedAt: true,
      },
    });

    const overrides: FinancialRequirementRule[] = [];
    const updatedMap = new Map<string, string>();

    for (const row of rows) {
      const rules = Array.isArray(row.rulesJson)
        ? row.rulesJson.map((item) => String(item)).filter(Boolean)
        : [];
      overrides.push({
        countryCode: normalizeCountryCode(row.countryCode),
        countryName: row.countryName,
        monthlyLivingCost: Number(row.monthlyLivingCost || 0),
        currency: String(row.currency || "USD").toUpperCase(),
        defaultMonths: Number(row.defaultMonths || 12),
        rules,
      });
      updatedMap.set(normalizeCountryCode(row.countryCode), row.updatedAt.toISOString());
    }

    const data = mergeRules(DEFAULT_FINANCIAL_REQUIREMENTS, overrides, updatedMap);
    return NextResponse.json({ data: { rules: data } });
  } catch (error) {
    console.error("[/api/admin/settings/financial-requirements GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const normalized = parsed.data.rules.map((row) => ({
      ...row,
      countryCode: normalizeCountryCode(row.countryCode),
      currency: row.currency.toUpperCase(),
      rules: row.rules.map((rule) => rule.trim()).filter(Boolean),
    }));

    await db.$transaction(async (tx) => {
      for (const row of normalized) {
        await tx.livingCostCountry.upsert({
          where: { countryCode: row.countryCode },
          update: {
            countryName: row.countryName,
            monthlyLivingCost: row.monthlyLivingCost,
            currency: row.currency,
            defaultMonths: row.defaultMonths,
            rulesJson: row.rules,
          },
          create: {
            countryCode: row.countryCode,
            countryName: row.countryName,
            monthlyLivingCost: row.monthlyLivingCost,
            currency: row.currency,
            defaultMonths: row.defaultMonths,
            rulesJson: row.rules,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.user.id,
            entityType: "financialRequirementSettings",
            entityId: row.countryCode,
            action: "upsert",
            details: JSON.stringify({
              countryName: row.countryName,
              monthlyLivingCost: row.monthlyLivingCost,
              currency: row.currency,
              defaultMonths: row.defaultMonths,
              rules: row.rules,
            }),
          },
        });
      }
    });

    return NextResponse.json({ data: { rules: normalized } });
  } catch (error) {
    console.error("[/api/admin/settings/financial-requirements PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
