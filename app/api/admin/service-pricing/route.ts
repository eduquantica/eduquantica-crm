import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ServicePaymentType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const pricingSchema = z.object({
  serviceType: z.nativeEnum(ServicePaymentType),
  name: z.string().trim().min(1),
  airport: z.string().trim().optional().nullable(),
  amount: z.number().min(0),
  currency: z.string().trim().default("GBP"),
  isActive: z.boolean().default(true),
});

function isAdmin(roleName?: string) {
  return roleName === "ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pricing = await db.servicePricing.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ data: pricing });
  } catch (error) {
    console.error("[GET /api/admin/service-pricing]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = pricingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const pricing = await db.servicePricing.create({ data: parsed.data });
    return NextResponse.json({ data: pricing }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/service-pricing]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}