import { NextResponse } from "next/server";
import { getPublicScholarships } from "@/lib/scholarship-website";

/**
 * Read-only list of active scholarships for the public website search.
 * No personal data. Cached at the edge for 10 minutes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPublicScholarships();
    return NextResponse.json(
      { data, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("[public/scholarships]", error);
    return NextResponse.json({ error: "Could not load scholarships" }, { status: 500 });
  }
}
