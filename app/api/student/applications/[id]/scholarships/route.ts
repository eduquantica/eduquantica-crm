import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      universityId: true,
    },
  });

  if (!application || application.studentId !== student.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const scholarships = await db.scholarship.findMany({
    where: {
      isActive: true,
      universityId: application.universityId,
      OR: [{ courseId: application.courseId }, { courseId: null }],
    },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      amount: true,
      amountType: true,
      percentageOf: true,
      currency: true,
      deadline: true,
      isPartial: true,
      eligibilityCriteria: true,
    },
  });

  const apps = await db.studentScholarshipApplication.findMany({
    where: {
      studentId: student.id,
      scholarshipId: { in: scholarships.map((item) => item.id) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scholarshipId: true,
      applicationId: true,
      status: true,
      awardedAmount: true,
      appliedAt: true,
    },
  });

  const appByScholarship = new Map<string, (typeof apps)[number]>();
  for (const row of apps) {
    if (!appByScholarship.has(row.scholarshipId)) {
      appByScholarship.set(row.scholarshipId, row);
    }
  }

  const exactAppByScholarship = new Map<string, (typeof apps)[number]>();
  for (const row of apps) {
    if (row.applicationId === application.id && !exactAppByScholarship.has(row.scholarshipId)) {
      exactAppByScholarship.set(row.scholarshipId, row);
    }
  }

  const data = scholarships.map((scholarship) => {
    const exact = exactAppByScholarship.get(scholarship.id) || null;
    const fallback = appByScholarship.get(scholarship.id) || null;
    const current = exact || fallback;

    return {
      ...scholarship,
      currentStatus: current?.status || null,
      appliedAt: current?.appliedAt || null,
      awardedAmount: current?.awardedAmount || null,
    };
  });

  return NextResponse.json({ data });
}
