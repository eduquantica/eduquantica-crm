import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ProviderType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const listingUpdateSchema = z.object({
  providerId: z.string().min(1).optional(),
  type: z.nativeEnum(ProviderType).optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  price: z.number().optional().nullable(),
  currency: z.string().trim().optional(),
  priceType: z.string().trim().optional().nullable(),
  availableFrom: z.string().optional().nullable(),
  availableTo: z.string().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  bathrooms: z.number().int().optional().nullable(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).max(5).optional(),
  isFullyFurnished: z.boolean().optional(),
  isBillsIncluded: z.boolean().optional(),
  jobTitle: z.string().trim().optional().nullable(),
  jobType: z.string().trim().optional().nullable(),
  jobSector: z.string().trim().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  hoursPerWeek: z.number().int().optional().nullable(),
  isRemote: z.boolean().optional(),
  eligibleNationalities: z.array(z.string()).optional(),
  eligibleStudyLevels: z.array(z.string()).optional(),
  applicationDeadline: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function asDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = listingUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const data = parsed.data;
    const listing = await db.serviceListing.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(data.availableFrom !== undefined ? { availableFrom: asDate(data.availableFrom) } : {}),
        ...(data.availableTo !== undefined ? { availableTo: asDate(data.availableTo) } : {}),
        ...(data.applicationDeadline !== undefined ? { applicationDeadline: asDate(data.applicationDeadline) } : {}),
      },
      include: { provider: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: listing });
  } catch (error) {
    console.error("[PATCH /api/admin/service-listings/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.serviceListing.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/service-listings/[id]]", error);
    return NextResponse.json({ error: "Unable to delete listing" }, { status: 400 });
  }
}