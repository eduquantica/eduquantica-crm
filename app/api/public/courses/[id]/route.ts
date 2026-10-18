import { NextResponse } from "next/server";
import { getPublicCourse } from "@/lib/course-website";

/** One course for the public website course page, with university profile and scholarships. */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const course = await getPublicCourse(params.id);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    return NextResponse.json(
      { data: course },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[public/courses/id]", error);
    return NextResponse.json({ error: "Could not load course" }, { status: 500 });
  }
}
