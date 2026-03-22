import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkPermission(session, "communications", "canEdit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tplId = params.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await req.json();
  const { name, subject, body: html } = body;
  if (!name || !subject || !html) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const tpl = await db.emailTemplate.update({
      where: { id: tplId },
      data: { name, subject, body: html },
    });
    return NextResponse.json({ template: tpl });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (err: any) {
    console.error("/api/dashboard/communications/templates/[id] PUT", err);
    return NextResponse.json({ error: err.message || "Error updating template" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkPermission(session, "communications", "canDelete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tplId = params.id;
  try {
    await db.emailTemplate.delete({ where: { id: tplId } });
    return NextResponse.json({ success: true });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (err: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error("/api/dashboard/communications/templates/[id] DELETE", err);
    return NextResponse.json({ error: err.message || "Error deleting template" }, { status: 500 });
  }
}
