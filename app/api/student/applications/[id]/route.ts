import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { readLatestAction, type OfferLetterExtracted } from "@/lib/application-finance";
import { getApplicationFeeSummary } from "@/lib/application-fees";
import { ensureApplicationMilestones } from "@/lib/application-milestones";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      nationality: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      studentId: true,
      status: true,
      visaSubStatus: true,
      visaRejectionReason: true,
      offerConditions: true,
      casNumber: true,
      createdAt: true,
      submittedAt: true,
      submittedToUniversityAt: true,
      conditionalOfferAt: true,
      unconditionalOfferAt: true,
      financeCompleteAt: true,
      casIssuedAt: true,
      visaAppliedAt: true,
      enrolledAt: true,
      withdrawnAt: true,
      offerReceivedAt: true,
      course: {
        select: {
          id: true,
          name: true,
          intakeDatesWithDeadlines: true,
          university: {
            select: {
              id: true,
              name: true,
              logo: true,
              country: true,
            },
          },
        },
      },
    },
  });

  if (!application || application.studentId !== student.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await ensureApplicationMilestones(tx, application.id);
  });

  const [logs, offerAction, fee, milestones] = await Promise.all([
    db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: application.id,
        action: "status_change",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    readLatestAction<{
      documentId?: string;
      fileName?: string;
      fileUrl?: string;
      uploadedAt?: string;
      ocr?: OfferLetterExtracted;
    }>(application.id, "offer_letter_uploaded"),
    getApplicationFeeSummary(application.id),
    db.applicationMilestoneDocument.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        milestone: true,
        title: true,
        description: true,
        required: true,
        status: true,
        fileName: true,
        fileUrl: true,
        uploadedAt: true,
        verifiedAt: true,
        notes: true,
      },
    }),
  ]);

  const statusHistory = logs.map((log) => {
    let statusFromDetails = application.status;
    let notes: string | null = null;

    try {
      const details = JSON.parse(log.details || "{}");
      if (typeof details.status === "string") {
        statusFromDetails = details.status;
      }
      if (typeof details.notes === "string") {
        notes = details.notes;
      }
    } catch {
      // ignore malformed details
    }

    return {
      id: log.id,
      status: statusFromDetails,
      createdAt: log.createdAt,
      notes,
      changedBy: {
        id: log.user.id,
        name: log.user.name,
        email: log.user.email,
      },
    };
  });

  const intake = Array.isArray(application.course.intakeDatesWithDeadlines)
    ? (application.course.intakeDatesWithDeadlines as Array<{ date?: string; deadline?: string }>)[0] || null
    : null;

  return NextResponse.json({
    data: {
      id: application.id,
      status: application.status,
      visaSubStatus: application.visaSubStatus,
      visaRejectionReason: application.visaRejectionReason,
      offerConditions: application.offerConditions,
      casNumber: application.casNumber,
      createdAt: application.createdAt,
      submittedAt: application.submittedAt,
      submittedToUniversityAt: application.submittedToUniversityAt,
      conditionalOfferAt: application.conditionalOfferAt,
      unconditionalOfferAt: application.unconditionalOfferAt,
      financeCompleteAt: application.financeCompleteAt,
      casIssuedAt: application.casIssuedAt,
      visaAppliedAt: application.visaAppliedAt,
      enrolledAt: application.enrolledAt,
      withdrawnAt: application.withdrawnAt,
      offerReceivedAt: application.offerReceivedAt,
      intake,
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        nationality: student.nationality,
      },
      university: application.course.university,
      course: {
        id: application.course.id,
        name: application.course.name,
      },
      statusHistory,
      milestones,
      fee,
      offerLetter: offerAction
        ? {
            documentId: offerAction.documentId || null,
            fileName: offerAction.fileName || null,
            fileUrl: offerAction.fileUrl || null,
            uploadedAt: offerAction.uploadedAt || null,
            ocr: offerAction.ocr || null,
          }
        : null,
    },
  });
}
