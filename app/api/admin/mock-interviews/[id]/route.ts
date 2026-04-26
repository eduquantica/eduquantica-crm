import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const STAFF_ROLES = ["ADMIN", "MANAGER", "COUNSELLOR", "BRANCH_MANAGER", "SUB_AGENT", "SUB_AGENT_COUNSELLOR"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !STAFF_ROLES.includes(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const interview = await db.mockInterview.findUnique({
    where: { id: params.id },
    include: {
      application: {
        select: {
          id: true,
          course: {
            select: {
              id: true,
              name: true,
              university: { select: { name: true, country: true } },
            },
          },
        },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          englishTestType: true,
          englishTestScore: true,
        },
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          exchanges: {
            orderBy: [{ questionNumber: "asc" }, { askedAt: "asc" }],
          },
        },
      },
      report: true,
      assignedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

  // Fetch eligibility result for this course + student
  const eligibility = await db.courseEligibilityResult.findUnique({
    where: {
      studentId_courseId: {
        studentId: interview.studentId,
        courseId: interview.application.course.id,
      },
    },
    select: {
      overallMet: true,
      englishMet: true,
      matchScore: true,
      missingSubjects: true,
      weakSubjects: true,
    },
  });

  // Fetch finance record for this application
  const finance = await db.financeRecord.findUnique({
    where: { applicationId: interview.applicationId },
    select: {
      depositPaid: true,
      courseFee: true,
      scholarshipFinal: true,
      remainingTuition: true,
      totalToShowInBank: true,
      courseFeeCurrency: true,
    },
  });

  return NextResponse.json({ data: { interview, eligibility, finance } });
}
