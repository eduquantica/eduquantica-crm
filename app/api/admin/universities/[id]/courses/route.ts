import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function staffGuard(session: any) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = session.user?.roleName;
  if (role === "STUDENT" || role === "SUB_AGENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const url = new URL(_request.url);
    const status = url.searchParams.get("status");

    const courses = await db.course.findMany({
      where: {
        universityId: params.id,
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        duration: true,
        tuitionFee: true,
        currency: true,
        intakeDatesWithDeadlines: true,
      },
    });

    return NextResponse.json({ data: { courses } });
  } catch (error) {
    console.error("[/api/admin/universities/[id]/courses GET]", error);
    return NextResponse.json({ error: "Failed to load courses", data: { courses: [] } }, { status: 500 });
  }
}
