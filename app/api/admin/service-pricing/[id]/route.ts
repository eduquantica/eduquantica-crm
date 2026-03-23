import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ServicePaymentType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const pricingUpdateSchema = z.object({
  serviceType: z.nativeEnum(ServicePaymentType).optional(),
  name: z.string().trim().min(1).optional(),
  airport: z.string().trim().optional().nullable(),
  amount: z.number().min(0).optional(),
  currency: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(roleName?: string) {
  return roleName === "ADMIN";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = pricingUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const pricing = await db.servicePricing.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ data: pricing });
  } catch (error) {
    console.error("[PATCH /api/admin/service-pricing/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.servicePricing.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/service-pricing/[id]]", error);
    return NextResponse.json({ error: "Unable to delete pricing" }, { status: 400 });
  }
}