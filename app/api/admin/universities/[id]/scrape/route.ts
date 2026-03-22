import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { scrapeWebsite } from "@/lib/scraper";

function staffGuard(session: unknown) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (session as any).user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const bodySchema = z.object({ url: z.string().url() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  // ensure university exists
  const univ = await db.university.findUnique({ where: { id: params.id } });
  if (!univ) {
    return NextResponse.json({ error: "University not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { url } = parsed.data;
    let result;
    try {
      result = await scrapeWebsite(url);
    } catch (err) {
      console.error("scrape failed", err);
      return NextResponse.json({ error: "This website could not be accessed automatically. Please download the Excel template and enter the data manually." }, { status: 400 });
    }
    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "university",
          entityId: params.id,
          action: "resync_website",
          details: `URL=${url}`,
        },
      });
    } catch (e) {
      console.error("Failed to log scrape activity", e);
    }
    return NextResponse.json({ data: result });
  } catch (e) {
    console.error("[/api/admin/universities/[id]/scrape POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}