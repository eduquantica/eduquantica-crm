import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MarketingMaterialType } from "@prisma/client";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(MarketingMaterialType).optional(),
  fileUrl: z.string().min(1).optional(),
  thumbnailUrl: z.string().optional().nullable(),
  availableTiers: z.array(z.enum(["GOLD", "SILVER", "PLATINUM"])).min(1).optional(),
  linkedUniversityId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function ensureStaff(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const updated = await db.marketingMaterial.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.fileUrl !== undefined ? { fileUrl: body.fileUrl } : {}),
      ...(body.thumbnailUrl !== undefined ? { thumbnailUrl: body.thumbnailUrl || null } : {}),
      ...(body.availableTiers !== undefined ? { availableTiers: body.availableTiers } : {}),
      ...(body.linkedUniversityId !== undefined ? { linkedUniversityId: body.linkedUniversityId || null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "marketing_material",
      entityId: updated.id,
      action: "updated",
      details: `Updated ${updated.name}`,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.marketingMaterial.delete({ where: { id: params.id } });
  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "marketing_material",
      entityId: params.id,
      action: "deleted",
      details: `Deleted material ${params.id}`,
    },
  });

  return NextResponse.json({ ok: true });
}
