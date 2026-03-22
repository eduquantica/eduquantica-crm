import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z.object({
  country: z.string().min(2).max(8),
  pageUrl: z.string().url(),
});

function isAdmin(session: unknown) {
  const roleName = (session as { user?: { roleName?: string } } | null)?.user?.roleName;
  return roleName === "ADMIN";
}

function canRead(session: unknown) {
  const roleName = (session as { user?: { roleName?: string } } | null)?.user?.roleName;
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!canRead(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = await db.immigrationMonitoredPage.findMany({
    orderBy: [{ country: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      country: true,
      pageUrl: true,
      isActive: true,
      status: true,
      lastCheckedAt: true,
      lastChangedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: pages });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminUserId = (session as { user?: { id?: string } } | null)?.user?.id;
  if (!adminUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  try {
    const page = await db.immigrationMonitoredPage.create({
      data: {
        country: parsed.data.country.trim().toUpperCase(),
        pageUrl: parsed.data.pageUrl.trim(),
      },
      select: {
        id: true,
        country: true,
        pageUrl: true,
        isActive: true,
        status: true,
        lastCheckedAt: true,
        lastChangedAt: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: adminUserId,
        entityType: "immigrationMonitor",
        entityId: page.id,
        action: "page_added",
        details: JSON.stringify({ country: page.country, pageUrl: page.pageUrl }),
      },
    });

    return NextResponse.json({ data: page }, { status: 201 });
  } catch (error) {
    console.error("[/api/admin/settings/immigration-monitor/pages POST]", error);
    return NextResponse.json({ error: "Failed to add URL" }, { status: 500 });
  }
}
