import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const EXCLUDED_ROLES = ["STUDENT", "SUB_AGENT"];

// PATCH /api/admin/settings/users/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = await req.json().catch(() => ({}));

  // Admin cannot deactivate or change their own role
  if (id === session.user.id) {
    if (body.isActive === false)
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.isActive === "boolean") {
    updateData.isActive = body.isActive;
  }

  if (typeof body.roleId === "string" && body.roleId) {
    const role = await db.role.findUnique({
      where: { id: body.roleId },
      select: { name: true },
    });
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    if (EXCLUDED_ROLES.includes(role.name))
      return NextResponse.json({ error: "Cannot assign this role to a staff account." }, { status: 400 });
    updateData.roleId = body.roleId;
  }

  if (Object.keys(updateData).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, isActive: true, roleId: true },
    });

    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "User",
        entityId: id,
        action: "UPDATED",
        details: `Updated user ${user.email}: ${JSON.stringify(updateData)}`,
      },
    });

    return user;
  });

  return NextResponse.json({ ok: true, data: updated });
}
