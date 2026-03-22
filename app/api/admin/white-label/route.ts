import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MarketingMaterialType } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(MarketingMaterialType),
  fileUrl: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  availableTiers: z.array(z.enum(["GOLD", "SILVER", "PLATINUM"]))
    .min(1)
    .default(["GOLD", "SILVER", "PLATINUM"]),
  linkedUniversityId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [materials, universities] = await Promise.all([
    db.marketingMaterial.findMany({
      where: { subAgentOwnerId: null },
      select: {
        id: true,
        name: true,
        type: true,
        fileUrl: true,
        thumbnailUrl: true,
        availableTiers: true,
        linkedUniversityId: true,
        linkedUniversity: { select: { name: true } },
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ data: { materials, universities } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const created = await db.marketingMaterial.create({
    data: {
      name: body.name,
      type: body.type,
      fileUrl: body.fileUrl,
      thumbnailUrl: body.thumbnailUrl || null,
      availableTiers: body.availableTiers,
      linkedUniversityId: body.linkedUniversityId || null,
      isActive: body.isActive,
      createdBy: session.user.id,
    },
  });

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "marketing_material",
      entityId: created.id,
      action: "created",
      details: `${body.name} (${body.type})`,
    },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
