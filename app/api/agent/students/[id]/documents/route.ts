import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendResendEmail } from "@/lib/resend";
import { randomUUID } from "crypto";
import { extractTextFromUrl, submitDocument } from "@/lib/copyleaks";
import { runDocumentScan } from "@/lib/document-scan-service";
import { NotificationService } from "@/lib/notifications";

const SCAN_ELIGIBLE_TYPES = new Set(["SOP", "PERSONAL_STATEMENT", "COVER_LETTER", "LOR"]);
const LOCK_SENSITIVE_TYPES = new Set(["SOP", "PERSONAL_STATEMENT"]);

const schema = z.object({
  type: z.enum([
    "PASSPORT",
    "TRANSCRIPT",
    "DEGREE_CERT",
    "ENGLISH_TEST",
    "SOP",
    "LOR",
    "CV",
    "FINANCIAL_PROOF",
    "PHOTO",
    "VISA_DOCUMENT",
    "PERSONAL_STATEMENT",
    "COVER_LETTER",
    "OTHER",
  ]),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!subAgent) return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });

  const payload = schema.parse(await req.json());

  const student = await db.student.findFirst({
    where: {
      id: params.id,
      subAgentId: subAgent.id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedCounsellorId: true,
      assignedCounsellor: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const hasLockedApprovedScan =
    LOCK_SENSITIVE_TYPES.has(payload.type) &&
    !!(await db.documentScanResult.findFirst({
      where: {
        isLocked: true,
        counsellorDecision: "ACCEPTED",
        document: {
          studentId: student.id,
          type: payload.type,
        },
      },
      select: { id: true },
    }));

  const created = await db.document.create({
    data: {
      studentId: student.id,
      type: payload.type,
      fileName: payload.fileName,
      fileUrl: payload.fileUrl,
      status: "PENDING",
      uploadedAfterApproval: hasLockedApprovedScan,
    },
  });

  const latestChecklist = await db.documentChecklist.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      items: {
        where: {
          documentType: payload.type,
          documentId: null,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const targetChecklistItemId = latestChecklist?.items[0]?.id;
  if (targetChecklistItemId) {
    await db.checklistItem.update({
      where: { id: targetChecklistItemId },
      data: {
        documentId: created.id,
        status: "UPLOADED",
      },
    });

    void runDocumentScan(targetChecklistItemId).catch((error) => {
      console.error(`Fraud detection scan failed for checklist item ${targetChecklistItemId}:`, error);
    });
  }

  if (SCAN_ELIGIBLE_TYPES.has(payload.type) && !hasLockedApprovedScan) {
    const pendingScan = await db.documentScanResult.create({
      data: {
        documentId: created.id,
        status: "PENDING",
      },
    });

    void (async () => {
      try {
        const extractedText = await extractTextFromUrl(payload.fileUrl);
        const scanId = randomUUID();
        const baseUrl = process.env.NEXTAUTH_URL;

        if (!baseUrl) {
          throw new Error("NEXTAUTH_URL is not configured for Copyleaks webhook callback");
        }

        const webhookUrl = `${baseUrl}/api/webhooks/copyleaks?scanId=${encodeURIComponent(scanId)}&documentId=${encodeURIComponent(created.id)}`;

        await submitDocument(scanId, extractedText, webhookUrl);

        await db.documentScanResult.update({
          where: { id: pendingScan.id },
          data: {
            status: "SCANNING",
            scanId,
          },
        });
      } catch (error) {
        console.error("Copyleaks scan trigger failed", error);
        await db.documentScanResult.update({
          where: { id: pendingScan.id },
          data: { status: "FAILED" },
        });
      }
    })();
  }

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "document",
      entityId: created.id,
      action: "uploaded_by_sub_agent",
      details: `${payload.type} for student ${student.id}`,
    },
  });

  if (student.assignedCounsellorId) {
    await db.activityLog.create({
      data: {
        userId: student.assignedCounsellorId,
        entityType: "document",
        entityId: created.id,
        action: "sub_agent_document_uploaded",
        details: `New ${payload.type} uploaded by sub-agent for ${student.firstName} ${student.lastName}`,
      },
    });

    await NotificationService.createNotification({
      userId: student.assignedCounsellorId,
      type: "DOCUMENT_UPLOADED",
      message: `New ${payload.type.replaceAll("_", " ")} uploaded by sub-agent for ${student.firstName} ${student.lastName}.`,
      linkUrl: `/dashboard/students/${student.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  const studentUserId = await db.student.findUnique({
    where: { id: student.id },
    select: { userId: true },
  });

  if (studentUserId?.userId) {
    await NotificationService.createNotification({
      userId: studentUserId.userId,
      type: "DOCUMENT_UPLOADED",
      message: `${payload.type.replaceAll("_", " ")} has been uploaded to your profile.`,
      linkUrl: "/student/documents",
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  if (hasLockedApprovedScan) {
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "document",
        entityId: created.id,
        action: "uploaded_after_statement_approval",
        details: `New ${payload.type} uploaded after approved statement lock for student ${student.id}`,
      },
    });
  }

  if (student.assignedCounsellor?.email) {
    try {
      await sendResendEmail({
        to: student.assignedCounsellor.email,
        subject: `New document uploaded by sub-agent - ${student.firstName} ${student.lastName}`,
        html: `<p>A new <strong>${payload.type.replace(/_/g, " ")}</strong> has been uploaded by the sub-agent for ${student.firstName} ${student.lastName}.</p><p>Please review it in the dashboard.</p>`,
      });
    } catch (error) {
      console.error("Failed to notify counsellor after sub-agent upload", error);
    }
  }

  return NextResponse.json(
    {
      data: created,
      uploadedAfterApproval: hasLockedApprovedScan,
      message: hasLockedApprovedScan
        ? "Your statement has been approved. A new scan cannot be generated."
        : null,
    },
    { status: 201 },
  );
}
