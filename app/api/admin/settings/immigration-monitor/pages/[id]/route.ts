import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function isAdmin(session: unknown) {
  const roleName = (session as { user?: { roleName?: string } } | null)?.user?.roleName;
  return roleName === "ADMIN";
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminUserId = (session as { user?: { id?: string } } | null)?.user?.id;
  if (!adminUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = await db.immigrationMonitoredPage.findUnique({
    where: { id: params.id },
    select: { id: true, country: true, pageUrl: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.immigrationMonitoredPage.delete({ where: { id: page.id } });

  await db.activityLog.create({
    data: {
      userId: adminUserId,
      entityType: "immigrationMonitor",
      entityId: page.id,
      action: "page_removed",
      details: JSON.stringify({ country: page.country, pageUrl: page.pageUrl }),
    },
  });

  return NextResponse.json({ ok: true });
}
