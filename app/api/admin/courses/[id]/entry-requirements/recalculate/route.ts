import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { MatchStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";

function canStaff(roleName?: string): boolean {
  return !!roleName && roleName !== "STUDENT" && roleName !== "ADMIN" && roleName !== "SUB_AGENT" && roleName !== "ADMIN";
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const recalculated = await EligibilityMatcher.recalculateForCourse(params.id);

    const summary = recalculated.results.reduce(
      (acc, item) => {
        if (item.matchStatus === MatchStatus.PENDING) acc.PENDING += 1;
        else if (item.matchStatus === MatchStatus.FULL_MATCH) acc.FULL_MATCH += 1;
        else if (item.matchStatus === MatchStatus.PARTIAL_MATCH) acc.PARTIAL_MATCH += 1;
        else acc.NO_MATCH += 1;
        return acc;
      },
      { PENDING: 0, FULL_MATCH: 0, PARTIAL_MATCH: 0, NO_MATCH: 0 },
    );

    return NextResponse.json({
      data: {
        courseId: params.id,
        recalculatedStudents: recalculated.totalStudents,
        summary,
      },
    });
  } catch (error) {
    console.error("[/api/admin/courses/[id]/entry-requirements/recalculate POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
