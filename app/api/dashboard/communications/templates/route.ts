import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ templates: [] });
  }

  // any authenticated user with view permission can list templates
  if (!checkPermission(session, "communications", "canView")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await db.emailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkPermission(session, "communications", "canCreate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await req.json();
  const { name, subject, body: html } = body;
  if (!name || !subject || !html) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const tpl = await db.emailTemplate.create({ data: { name, subject, body: html } });
    return NextResponse.json({ template: tpl }, { status: 201 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (err: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error("/api/dashboard/communications/templates POST", err);
    return NextResponse.json({ error: err.message || "Error creating template" }, { status: 500 });
  }
}
