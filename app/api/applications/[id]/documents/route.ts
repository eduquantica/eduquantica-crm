import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z.object({
  milestoneType: z.enum([
    "OFFER_LETTER",
    "CAS_LETTER",
    "FINANCE_DEPOSIT_RECEIPT",
    "VISA_COPY",
    "ENROLMENT_CONFIRMATION",
  ]),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  offerType: z.enum(["CONDITIONAL", "UNCONDITIONAL"]).optional(),
  visaOutcome: z.enum(["APPROVED", "REFUSED"]).optional(),
  notes: z.string().optional(),
});

const CAS_UPLOAD_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

function getStudentNotificationMessage(input: {
  milestoneType: "OFFER_LETTER" | "CAS_LETTER" | "FINANCE_DEPOSIT_RECEIPT" | "VISA_COPY" | "ENROLMENT_CONFIRMATION";
  visaOutcome?: "APPROVED" | "REFUSED";
}) {
  if (input.milestoneType === "OFFER_LETTER") {
    return "Your offer letter is ready. Check your application.";
  }
  if (input.milestoneType === "CAS_LETTER") {
    return "Your CAS letter has been issued.";
  }
  if (input.milestoneType === "VISA_COPY" && input.visaOutcome === "APPROVED") {
    return "Congratulations! Your visa has been approved.";
  }
  if (input.milestoneType === "ENROLMENT_CONFIRMATION") {
    return "Your enrolment confirmation is available.";
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      offerConditions: true,
      createdAt: true,
      intake: true,
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      university: {
        select: {
          name: true,
          country: true,
        },
      },
      course: {
        select: {
          name: true,
          level: true,
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const documents = await db.applicationDocument.findMany({
    where: { applicationId: application.id },
    orderBy: { createdAt: "asc" },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          role: { select: { name: true, label: true } },
        },
      },
    },
  });

  return NextResponse.json({
    data: documents,
    application: {
      id: application.id,
      status: application.status,
      offerConditions: application.offerConditions,
      createdAt: application.createdAt,
      intake: application.intake,
      studentName: `${application.student.firstName} ${application.student.lastName}`.trim(),
      universityName: application.university.name,
      universityCountry: application.university.country,
      courseName: application.course.name,
      courseLevel: application.course.level,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = createSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    select: { id: true, studentId: true, student: { select: { userId: true } } },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (payload.data.milestoneType === "CAS_LETTER" && !CAS_UPLOAD_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Only Admin/Manager/Counsellor can upload CAS letters" }, { status: 403 });
  }

  const created = await db.applicationDocument.create({
    data: {
      applicationId: application.id,
      studentId: application.studentId,
      milestoneType: payload.data.milestoneType,
      offerType: payload.data.offerType,
      visaOutcome: payload.data.visaOutcome,
      fileName: payload.data.fileName,
      fileUrl: payload.data.fileUrl,
      notes: payload.data.notes,
      uploadedById: session.user.id,
      uploadedByRole: session.user.roleName,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          role: { select: { name: true, label: true } },
        },
      },
    },
  });

  const studentMessage = getStudentNotificationMessage({
    milestoneType: payload.data.milestoneType,
    visaOutcome: payload.data.visaOutcome,
  });

  if (studentMessage && application.student?.userId) {
    await db.activityLog.create({
      data: {
        userId: application.student.userId,
        entityType: "student_notification",
        entityId: application.id,
        action: "application_milestone_notification",
        details: studentMessage,
      },
    });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}
