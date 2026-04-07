import { ApplicationMilestone, ApplicationMilestoneStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureApplicationMilestones } from "@/lib/application-milestones";
import { NotificationService } from "@/lib/notifications";
import { saveToStudentDocument } from "@/lib/saveToStudentDocument";

const MILESTONE_LABELS: Record<ApplicationMilestone, string> = {
  APPLICATION_SUBMISSION: "Application Submission",
  OFFER_LETTER: "Offer Letter",
  FINANCE: "Finance",
  CAS: "CAS",
  VISA: "Visa",
};

const canManage = (role?: string) => role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR" || role === "SUB_AGENT";
const canView = (role?: string) => canManage(role) || role === "STUDENT";

const updateSchema = z.object({
  milestone: z.enum(["APPLICATION_SUBMISSION", "OFFER_LETTER", "FINANCE", "CAS", "VISA"]),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  fileName: z.string().trim().optional(),
  fileUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(["MISSING", "UPLOADED", "VERIFIED", "REJECTED"]).optional(),
});

async function loadApplication(id: string) {
  return db.application.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      counsellorId: true,
      student: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
          subAgent: { select: { userId: true } },
        },
      },
    },
  });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canView(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await loadApplication(params.id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (session.user.roleName === "STUDENT" && application.student.userId !== session.user.id) return forbidden();
  if (session.user.roleName === "COUNSELLOR" && application.student.assignedCounsellorId !== session.user.id) return forbidden();
  if (session.user.roleName === "SUB_AGENT" && application.student.subAgent?.userId !== session.user.id) return forbidden();

  await db.$transaction(async (tx) => {
    await ensureApplicationMilestones(tx, application.id);
  });

  const rows = await db.applicationMilestoneDocument.findMany({
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
      verifiedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ data: rows });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await loadApplication(params.id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (session.user.roleName === "COUNSELLOR" && application.student.assignedCounsellorId !== session.user.id) return forbidden();
  if (session.user.roleName === "SUB_AGENT" && application.student.subAgent?.userId !== session.user.id) return forbidden();

  const body = await req.json();
  const payload = updateSchema.parse(body);

  const nextStatus = payload.status
    ?? (payload.fileUrl?.trim() ? "UPLOADED" : undefined)
    ?? undefined;

  const updated = await db.applicationMilestoneDocument.upsert({
    where: {
      applicationId_milestone: {
        applicationId: application.id,
        milestone: payload.milestone,
      },
    },
    create: {
      applicationId: application.id,
      milestone: payload.milestone,
      title: payload.title || MILESTONE_LABELS[payload.milestone],
      description: payload.description || null,
      status: nextStatus || "MISSING",
      fileName: payload.fileName || null,
      fileUrl: payload.fileUrl || null,
      notes: payload.notes || null,
      uploadedAt: payload.fileUrl?.trim() ? new Date() : null,
      verifiedAt: nextStatus === "VERIFIED" ? new Date() : null,
      verifiedById: nextStatus === "VERIFIED" ? session.user.id : null,
    },
    update: {
      title: payload.title,
      description: payload.description,
      status: nextStatus,
      fileName: payload.fileName,
      fileUrl: payload.fileUrl,
      notes: payload.notes,
      uploadedAt: payload.fileUrl?.trim() ? new Date() : undefined,
      verifiedAt: nextStatus === "VERIFIED" ? new Date() : nextStatus === "REJECTED" ? null : undefined,
      verifiedById: nextStatus === "VERIFIED" ? session.user.id : nextStatus === "REJECTED" ? null : undefined,
    },
    select: {
      id: true,
      milestone: true,
      title: true,
      status: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
      verifiedAt: true,
      notes: true,
    },
  });

  if (payload.milestone === "FINANCE" && payload.fileUrl?.trim() && payload.fileName?.trim()) {
    const savedDeposit = await saveToStudentDocument(
      application.studentId,
      "DEPOSIT_RECEIPT",
      payload.fileUrl,
      payload.fileName,
      session.user.id,
    );

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "deposit_receipt_uploaded",
        details: JSON.stringify({
          documentId: savedDeposit.id,
          fileName: payload.fileName,
          fileUrl: payload.fileUrl,
          uploadedAt: new Date().toISOString(),
          ocr: {
            amountPaid: null,
            paymentDate: null,
            paymentReference: null,
            currency: null,
            confidence: null,
          },
        }),
      },
    }).catch(() => undefined);
  }

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "application",
      entityId: application.id,
      action: "milestone_document_updated",
      details: JSON.stringify({
        milestone: payload.milestone,
        status: updated.status,
        fileName: updated.fileName || null,
      }),
    },
  }).catch(() => undefined);

  if (application.student.userId !== session.user.id) {
    await NotificationService.createNotification({
      userId: application.student.userId,
      type: "DOCUMENT_MILESTONE_UPDATED",
      message: `${MILESTONE_LABELS[payload.milestone]} document was updated for your application.`,
      linkUrl: `/student/applications/${application.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await loadApplication(params.id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (session.user.roleName === "COUNSELLOR" && application.student.assignedCounsellorId !== session.user.id) return forbidden();
  if (session.user.roleName === "SUB_AGENT" && application.student.subAgent?.userId !== session.user.id) return forbidden();

  const milestone = req.nextUrl.searchParams.get("milestone") as ApplicationMilestone | null;
  if (!milestone) {
    return NextResponse.json({ error: "Milestone is required" }, { status: 400 });
  }

  const updated = await db.applicationMilestoneDocument.update({
    where: {
      applicationId_milestone: {
        applicationId: application.id,
        milestone,
      },
    },
    data: {
      status: "MISSING" as ApplicationMilestoneStatus,
      fileName: null,
      fileUrl: null,
      uploadedAt: null,
      verifiedAt: null,
      verifiedById: null,
      notes: null,
    },
    select: {
      id: true,
      milestone: true,
      status: true,
    },
  });

  return NextResponse.json({ data: updated });
}
