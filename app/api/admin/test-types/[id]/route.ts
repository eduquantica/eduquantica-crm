import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  isIELTS: z.boolean().optional(),
});

function isAdminEditor(roleName: string | undefined) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminEditor(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const payload = updateSchema.parse(await req.json());

    const updated = await db.testType.update({
      where: { id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(typeof payload.isIELTS === "boolean" ? { isIELTS: payload.isIELTS } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update test type" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminEditor(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await db.testType.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Failed to delete test type" }, { status: 500 });
  }
}
