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

const createSchema = z.object({
  name: z.string().min(1, "Role name is required").max(50),
  label: z.string().min(1, "Display label is required").max(50),
  permissions: permSchema,
});

function adminGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET /api/admin/settings/roles
export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const roles = await db.role.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      label: true,
      isBuiltIn: true,
      createdAt: true,
      permissions: {
        select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
      },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({ data: roles });
}

// POST /api/admin/settings/roles
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // Normalise name (uppercase, underscores)
    const normalizedName = data.name.trim().toUpperCase().replace(/\s+/g, "_");

    const existing = await db.role.findUnique({ where: { name: normalizedName }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "A role with this name already exists." }, { status: 409 });

    const role = await db.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: { name: normalizedName, label: data.label, isBuiltIn: false },
        select: { id: true, name: true, label: true },
      });

      // Create one permission record per module
      const permRecords = MODULES.map((module) => {
        const p = data.permissions[module] ?? { canView: false, canCreate: false, canEdit: false, canDelete: false };
        // Settings is always locked to admin — force false for custom roles
        if (module === "settings") {
          return { roleId: created.id, module, canView: false, canCreate: false, canEdit: false, canDelete: false };
        }
        return { roleId: created.id, module, ...p };
      });

      await tx.permission.createMany({ data: permRecords });

      await tx.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "Role",
          entityId: created.id,
          action: "CREATED",
          details: `Created custom role: ${created.name}`,
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, id: role.id }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    console.error("[settings/roles POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
