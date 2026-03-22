import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/admin/settings/roles/[id]/duplicate
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const source = await db.role.findUnique({
    where: { id: params.id },
    select: {
      name: true,
      label: true,
      permissions: { select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true } },
    },
  });
  if (!source) return NextResponse.json({ error: "Role not found." }, { status: 404 });

  // Build a unique name
  const newName = `COPY_OF_${source.name}`;
  const newLabel = `Copy of ${source.label}`;

  const existing = await db.role.findUnique({ where: { name: newName }, select: { id: true } });
  if (existing)
    return NextResponse.json({ error: `A role named "${newName}" already exists.` }, { status: 409 });

  const created = await db.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { name: newName, label: newLabel, isBuiltIn: false },
      select: { id: true, name: true, label: true },
    });

    if (source.permissions.length > 0) {
      await tx.permission.createMany({
        data: source.permissions.map((p) => ({ ...p, roleId: role.id })),
      });
    }

    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "Role",
        entityId: role.id,
        action: "DUPLICATED",
        details: `Duplicated role "${source.name}" as "${role.name}"`,
      },
    });

    return role;
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
