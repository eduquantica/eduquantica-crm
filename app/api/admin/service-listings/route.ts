import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ProviderType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const listingSchema = z.object({
  providerId: z.string().min(1),
  type: z.nativeEnum(ProviderType),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  price: z.number().optional().nullable(),
  currency: z.string().trim().default("GBP"),
  priceType: z.string().trim().optional().nullable(),
  availableFrom: z.string().optional().nullable(),
  availableTo: z.string().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  bathrooms: z.number().int().optional().nullable(),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).max(5).default([]),
  isFullyFurnished: z.boolean().default(false),
  isBillsIncluded: z.boolean().default(false),
  jobTitle: z.string().trim().optional().nullable(),
  jobType: z.string().trim().optional().nullable(),
  jobSector: z.string().trim().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  hoursPerWeek: z.number().int().optional().nullable(),
  isRemote: z.boolean().default(false),
  eligibleNationalities: z.array(z.string()).default([]),
  eligibleStudyLevels: z.array(z.string()).default([]),
  applicationDeadline: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function asDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const type = request.nextUrl.searchParams.get("type") || "";
    const country = request.nextUrl.searchParams.get("country")?.trim() || "";
    const providerId = request.nextUrl.searchParams.get("providerId") || "";
    const active = request.nextUrl.searchParams.get("active");

    const listings = await db.serviceListing.findMany({
      where: {
        ...(type && Object.values(ProviderType).includes(type as ProviderType) ? { type: type as ProviderType } : {}),
        ...(country ? { country: { contains: country, mode: "insensitive" } } : {}),
        ...(providerId ? { providerId } : {}),
        ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { provider: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        provider: { select: { id: true, name: true, type: true } },
        _count: { select: { applications: true, referrals: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: listings });
  } catch (error) {
    console.error("[GET /api/admin/service-listings]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = listingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const listing = await db.serviceListing.create({
      data: {
        ...parsed.data,
        availableFrom: asDate(parsed.data.availableFrom),
        availableTo: asDate(parsed.data.availableTo),
        applicationDeadline: asDate(parsed.data.applicationDeadline),
      },
      include: { provider: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: listing }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/service-listings]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}