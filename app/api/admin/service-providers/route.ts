import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { ProviderType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const providerSchema = z.object({
  name: z.string().trim().min(1),
  type: z.nativeEnum(ProviderType),
  logo: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  country: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  commissionRate: z.number().min(0).max(100).default(10),
  commissionType: z.string().trim().default("PERCENTAGE"),
  agreementStart: z.string().optional().nullable(),
  agreementEnd: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  contactPerson: z.string().trim().optional().nullable(),
  contactEmail: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  agreementDocUrl: z.string().trim().optional().nullable(),
});

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function asDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const providers = await db.serviceProvider.findMany({
      include: {
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: providers });
  } catch (error) {
    console.error("[GET /api/admin/service-providers]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = providerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const provider = await db.serviceProvider.create({
      data: {
        ...parsed.data,
        agreementStart: asDate(parsed.data.agreementStart),
        agreementEnd: asDate(parsed.data.agreementEnd),
        agreementSigned: Boolean(parsed.data.agreementDocUrl),
      },
    });

    return NextResponse.json({ data: provider }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/service-providers]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}