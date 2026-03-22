import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const applications = await db.application.findMany({
      where: { status: "ENROLLED" },
      include: {
        student: true,
        university: true,
        course: true,
        counsellor: true,
        postEnrolment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const appIds = applications.map((a) => a.id);

    const enrolmentLogs = appIds.length
      ? await db.activityLog.findMany({
          where: {
            entityType: "application",
            entityId: { in: appIds },
            action: "status_changed_to_ENROLLED",
          },
          orderBy: { createdAt: "asc" },
          select: {
            entityId: true,
            createdAt: true,
          },
        })
      : [];

    const enrolmentDateMap = new Map<string, string>();
    for (const log of enrolmentLogs) {
      if (!enrolmentDateMap.has(log.entityId)) {
        enrolmentDateMap.set(log.entityId, log.createdAt.toISOString());
      }
    }

    const data = applications.map((app) => ({
      applicationId: app.id,
      studentId: app.student.id,
      studentName: `${app.student.firstName} ${app.student.lastName}`,
      university: app.university.name,
      course: app.course.name,
      enrolmentDate: enrolmentDateMap.get(app.id) || app.createdAt.toISOString(),
      accommodationStatus: app.postEnrolment?.accommodationStatus || "NOT_ARRANGED",
      airportStatus: app.postEnrolment?.airportStatus || "NOT_REQUIRED",
      briefingStatus: app.postEnrolment?.briefingStatus || "NOT_SCHEDULED",
      feedbackStatus: app.postEnrolment?.feedbackStatus || "NOT_SENT",
      counsellorName: app.counsellor?.name || app.counsellor?.email || "-",
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching student services list", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
