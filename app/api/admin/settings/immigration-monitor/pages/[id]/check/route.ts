import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkForChanges } from "@/lib/immigration-monitor";

function canRun(session: unknown) {
  const role = (session as { user?: { roleName?: string } } | null)?.user?.roleName;
  return role === "ADMIN" || role === "MANAGER";
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!canRun(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorUserId = (session as { user?: { id?: string } } | null)?.user?.id;

  const page = await db.immigrationMonitoredPage.findUnique({
    where: { id: params.id },
    select: { id: true, pageUrl: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await checkForChanges(page.pageUrl);

  if (actorUserId) {
    await db.activityLog.create({
      data: {
        userId: actorUserId,
        entityType: "immigrationMonitor",
        entityId: page.id,
        action: "manual_check",
        details: JSON.stringify(result),
      },
    });
  }

  return NextResponse.json({ data: result });
}
