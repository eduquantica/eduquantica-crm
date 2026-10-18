import { NextRequest, NextResponse } from "next/server";
import { searchPublicCourses } from "@/lib/course-website";

/**
 * Read-only course search for the public website. Query: q, country, level,
 * subject, university, mode, intake, maxFee, sort (name | fee_asc | fee_desc),
 * page, pageSize (max 48). No personal data. Not cached here: the website caches it and is told to refresh on every save (lib/website-revalidate.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const result = await searchPublicCourses(params);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[public/courses]", error);
    return NextResponse.json({ error: "Could not load courses" }, { status: 500 });
  }
}
