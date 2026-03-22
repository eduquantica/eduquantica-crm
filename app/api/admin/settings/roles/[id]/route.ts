import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const MODULES = [
  "dashboard", "leads", "students", "applications", "universities",
  "courses", "sub-agents", "communications", "tasks", "commissions",
  "visa", "documents", "reports", "settings",
];

const permSchema = z.record(
  z.string(),
  z.object({
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  }),
);

function adminGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET /api/admin/settings/roles/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  void req;
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const role = await db.role.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      label: true,
      isBuiltIn: true,
      permissions: { select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true } },
      _count: { select: { users: true } },
    },
  });

  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  return NextResponse.json({ data: role });
}

// PATCH /api/admin/settings/roles/[id]  — update permissions
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const role = await db.role.findUnique({
    where: { id: params.id },
    select: { id: true, isBuiltIn: true, name: true },
  });
  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (role.isBuiltIn)
    return NextResponse.json({ error: "Built-in role permissions cannot be edited." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = permSchema.safeParse(body.permissions);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid permissions data." }, { status: 400 });

  await db.$transaction(async (tx) => {
    // Upsert each module permission
    for (const mod of MODULES) {
      const p = parsed.data[mod] ?? { canView: false, canCreate: false, canEdit: false, canDelete: false };
      const safe = mod === "settings"
        ? { canView: false, canCreate: false, canEdit: false, canDelete: false }
        : p;

      await tx.permission.upsert({
        where: { roleId_module: { roleId: params.id, module: mod } },
        create: { roleId: params.id, module: mod, ...safe },
        update: safe,
      });
    }

    await tx.activityLog.create({
      data: {
        userId: session!.user.id,
        entityType: "Role",
        entityId: params.id,
        action: "PERMISSIONS_UPDATED",
        details: `Updated permissions for role: ${role.name}`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/settings/roles/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const role = await db.role.findUnique({
    where: { id: params.id },
    select: { isBuiltIn: true, name: true, _count: { select: { users: true } } },
  });
  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (role.isBuiltIn) return NextResponse.json({ error: "Built-in roles cannot be deleted." }, { status: 400 });
  if (role._count.users > 0)
    return NextResponse.json(
      { error: `Cannot delete role — ${role._count.users} user(s) assigned.`, userCount: role._count.users },
      { status: 409 },
    );

  await db.$transaction(async (tx) => {
    // Permissions are cascade-deleted by the schema
    await tx.role.delete({ where: { id: params.id } });
    await tx.activityLog.create({
      data: {
        userId: session!.user.id,
        entityType: "Role",
        entityId: params.id,
        action: "DELETED",
        details: `Deleted custom role: ${role.name}`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
