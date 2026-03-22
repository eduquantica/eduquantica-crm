import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { FeeConfigType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAcademicYearLabel } from "@/lib/application-fees";

export const dynamic = "force-dynamic";

const READ_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);
const WRITE_ROLES = new Set(["ADMIN", "MANAGER"]);

const updateUcasSchema = z.object({
  action: z.literal("updateUcas"),
  academicYear: z.string().min(4),
  singleAmount: z.number().min(0),
  multipleAmount: z.number().min(0),
  effectiveFrom: z.string().min(1),
  currency: z.string().min(3).max(3).default("GBP"),
  notes: z.string().optional().nullable(),
});

const updateUniversityFeesSchema = z.object({
  action: z.literal("updateUniversityFees"),
  academicYear: z.string().optional(),
  effectiveFrom: z.string().optional(),
  currency: z.string().min(3).max(3).default("GBP"),
  updates: z.array(z.object({
    universityId: z.string().min(1),
    amount: z.number().min(0),
  })).min(1),
  notes: z.string().optional().nullable(),
});

const requestSchema = z.union([updateUcasSchema, updateUniversityFeesSchema]);

function combineUcasHistory(rows: Array<{
  configType: FeeConfigType;
  academicYear: string;
  amount: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
}>) {
  const map = new Map<string, {
    academicYear: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    currency: string;
    singleAmount: number | null;
    multipleAmount: number | null;
    createdAt: string;
  }>();

  for (const row of rows) {
    const key = `${row.academicYear}-${row.effectiveFrom.toISOString()}`;
    const existing = map.get(key) || {
      academicYear: row.academicYear,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
      currency: row.currency,
      singleAmount: null,
      multipleAmount: null,
      createdAt: row.createdAt.toISOString(),
    };

    if (row.configType === FeeConfigType.UCAS_SINGLE) existing.singleAmount = row.amount;
    if (row.configType === FeeConfigType.UCAS_MULTIPLE) existing.multipleAmount = row.amount;
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

async function loadPayload() {
  const [configs, universities] = await Promise.all([
    db.applicationFeeConfig.findMany({
      where: {
        configType: { in: [FeeConfigType.UCAS_SINGLE, FeeConfigType.UCAS_MULTIPLE] },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        configType: true,
        academicYear: true,
        amount: true,
        currency: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
      },
    }),
    db.university.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        country: true,
        applicationFee: true,
      },
    }),
  ]);

  const now = new Date();
  const activeSingle = configs.find((row) => row.configType === FeeConfigType.UCAS_SINGLE && row.effectiveFrom <= now && (!row.effectiveTo || row.effectiveTo >= now))
    || configs.find((row) => row.configType === FeeConfigType.UCAS_SINGLE)
    || null;

  const activeMultiple = configs.find((row) => row.configType === FeeConfigType.UCAS_MULTIPLE && row.effectiveFrom <= now && (!row.effectiveTo || row.effectiveTo >= now))
    || configs.find((row) => row.configType === FeeConfigType.UCAS_MULTIPLE)
    || null;

  const directConfigs = await db.applicationFeeConfig.findMany({
    where: {
      configType: FeeConfigType.UNIVERSITY_DIRECT,
      universityId: { not: null },
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: {
      universityId: true,
      updatedAt: true,
      amount: true,
      currency: true,
    },
  });

  const directMap = new Map<string, { updatedAt: string; amount: number; currency: string }>();
  for (const row of directConfigs) {
    if (!row.universityId || directMap.has(row.universityId)) continue;
    directMap.set(row.universityId, {
      updatedAt: row.updatedAt.toISOString(),
      amount: row.amount,
      currency: row.currency,
    });
  }

  return {
    ucasCurrent: {
      academicYear: activeSingle?.academicYear || activeMultiple?.academicYear || getAcademicYearLabel(),
      effectiveFrom: (activeSingle?.effectiveFrom || activeMultiple?.effectiveFrom || now).toISOString(),
      singleAmount: activeSingle?.amount || 0,
      multipleAmount: activeMultiple?.amount || 0,
      currency: activeSingle?.currency || activeMultiple?.currency || "GBP",
    },
    ucasHistory: combineUcasHistory(configs),
    universities: universities.map((university) => ({
      ...university,
      lastUpdatedAt: directMap.get(university.id)?.updatedAt || null,
    })),
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !READ_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ data: await loadPayload() });
  } catch (error) {
    console.error("[/api/admin/settings/application-fees GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !WRITE_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const payload = parsed.data;

    if (payload.action === "updateUcas") {
      const effectiveFrom = new Date(payload.effectiveFrom);
      const currency = payload.currency.toUpperCase();

      await db.$transaction(async (tx) => {
        for (const configType of [FeeConfigType.UCAS_SINGLE, FeeConfigType.UCAS_MULTIPLE] as const) {
          await tx.applicationFeeConfig.updateMany({
            where: {
              configType,
              universityId: null,
              effectiveTo: null,
            },
            data: {
              effectiveTo: new Date(effectiveFrom.getTime() - 1),
            },
          });

          await tx.applicationFeeConfig.create({
            data: {
              configType,
              amount: configType === FeeConfigType.UCAS_SINGLE ? payload.singleAmount : payload.multipleAmount,
              currency,
              academicYear: payload.academicYear,
              effectiveFrom,
              notes: payload.notes || null,
              createdBy: session.user.id,
            },
          });
        }
      });
    }

    if (payload.action === "updateUniversityFees") {
      const academicYear = payload.academicYear || getAcademicYearLabel();
      const effectiveFrom = new Date(payload.effectiveFrom || new Date().toISOString());
      const currency = payload.currency.toUpperCase();

      await db.$transaction(async (tx) => {
        for (const row of payload.updates) {
          await tx.university.update({
            where: { id: row.universityId },
            data: { applicationFee: row.amount },
          });

          await tx.applicationFeeConfig.create({
            data: {
              configType: FeeConfigType.UNIVERSITY_DIRECT,
              universityId: row.universityId,
              amount: row.amount,
              currency,
              academicYear,
              effectiveFrom,
              notes: payload.notes || null,
              createdBy: session.user.id,
            },
          });

          await tx.activityLog.create({
            data: {
              userId: session.user.id,
              entityType: "university_fee",
              entityId: row.universityId,
              action: "updated",
              details: JSON.stringify({
                amount: row.amount,
                currency,
                academicYear,
              }),
            },
          });
        }
      });
    }

    return NextResponse.json({ data: await loadPayload() });
  } catch (error) {
    console.error("[/api/admin/settings/application-fees PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
