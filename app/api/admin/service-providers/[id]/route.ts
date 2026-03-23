import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { ProviderType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const providerUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.nativeEnum(ProviderType).optional(),
  logo: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  country: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  commissionRate: z.number().min(0).max(100).optional(),
  commissionType: z.string().trim().optional(),
  agreementStart: z.string().optional().nullable(),
  agreementEnd: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  contactPerson: z.string().trim().optional().nullable(),
  contactEmail: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  agreementDocUrl: z.string().trim().optional().nullable(),
  agreementSigned: z.boolean().optional(),
});

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function asDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const provider = await db.serviceProvider.findUnique({
      where: { id: params.id },
      include: {
        listings: { orderBy: { createdAt: "desc" } },
        commissions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ data: provider });
  } catch (error) {
    console.error("[GET /api/admin/service-providers/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
    const parsed = providerUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const data = parsed.data;
    const provider = await db.serviceProvider.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(data.agreementStart !== undefined ? { agreementStart: asDate(data.agreementStart) } : {}),
        ...(data.agreementEnd !== undefined ? { agreementEnd: asDate(data.agreementEnd) } : {}),
        ...(data.agreementDocUrl !== undefined
          ? {
              agreementDocUrl: data.agreementDocUrl,
              agreementSigned: data.agreementSigned ?? Boolean(data.agreementDocUrl),
            }
          : {}),
      },
    });

    return NextResponse.json({ data: provider });
  } catch (error) {
    console.error("[PATCH /api/admin/service-providers/[id]]", error);
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
    await db.serviceProvider.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/service-providers/[id]]", error);
    return NextResponse.json({ error: "Unable to delete provider" }, { status: 400 });
  }
}