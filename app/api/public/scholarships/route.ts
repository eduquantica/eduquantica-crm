import { NextResponse } from "next/server";
import { getPublicScholarships } from "@/lib/scholarship-website";

/**
 * Read-only list of active scholarships for the public website search.
 * No personal data. Not cached here: the website caches it and is told to refresh on every save (lib/website-revalidate.ts).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPublicScholarships();
    return NextResponse.json(
      { data, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[public/scholarships]", error);
    return NextResponse.json({ error: "Could not load scholarships" }, { status: 500 });
  }
}
