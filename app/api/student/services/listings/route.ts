import { ProviderType } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canAccess(roleName?: string) {
  return Boolean(roleName);
}

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccess(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const type = request.nextUrl.searchParams.get("type") || "";
    const country = request.nextUrl.searchParams.get("country")?.trim() || "";
    const city = request.nextUrl.searchParams.get("city")?.trim() || "";
    const priceMin = parseNumber(request.nextUrl.searchParams.get("priceMin"));
    const priceMax = parseNumber(request.nextUrl.searchParams.get("priceMax"));

    const listings = await db.serviceListing.findMany({
      where: {
        isActive: true,
        ...(type && Object.values(ProviderType).includes(type as ProviderType)
          ? { type: type as ProviderType }
          : {}),
        ...(country
          ? { country: { contains: country, mode: "insensitive" } }
          : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...((priceMin !== undefined || priceMax !== undefined) && {
          price: {
            ...(priceMin !== undefined ? { gte: priceMin } : {}),
            ...(priceMax !== undefined ? { lte: priceMax } : {}),
          },
        }),
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        city: true,
        country: true,
        price: true,
        currency: true,
        availableFrom: true,
        availableTo: true,
        bedrooms: true,
        bathrooms: true,
        amenities: true,
        images: true,
        isFullyFurnished: true,
        isBillsIncluded: true,
        jobTitle: true,
        jobType: true,
        jobSector: true,
        salaryMin: true,
        salaryMax: true,
        hoursPerWeek: true,
        isRemote: true,
        applicationDeadline: true,
        isFeatured: true,
      },
    });

    return NextResponse.json({ data: listings });
  } catch (error) {
    console.error("[GET /api/student/services/listings]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}