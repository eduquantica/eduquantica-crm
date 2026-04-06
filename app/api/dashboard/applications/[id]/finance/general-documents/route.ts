import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDocumentScan } from "@/lib/document-scan-service";

const payloadSchema = z.object({
  key: z.enum([
    "PASSPORT",
    "ACADEMIC",
    "ENGLISH_TEST",
    "TB_TEST",
    "POST_STUDY_PLAN",
    "SOURCE_OF_FUNDS",
    "SOURCE_OF_FUNDS_EVIDENCE",
    "PARENT_ID_DOCUMENT",
    "BIRTH_CERTIFICATE",
    "DECLARATION_LETTER",
    "SPONSOR_ID_DOCUMENT",
    "SPONSORSHIP_DECLARATION_LETTER",
    "SPONSORSHIP_CONFIRMATION_LETTER",
    "SCHOLARSHIP_LETTER",
  ]),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  context: z
    .object({
      accountIndex: z.number().int().min(0).optional(),
      sponsorType: z.enum(["COMPANY", "GOVERNMENT", "UNIVERSITY", "THIRD_PARTY_ORGANISATION"]).optional(),
      ownershipType: z.enum(["MY_PARENTS", "MY_SPONSOR", "MY_LOAN_PROVIDER", "OTHER_FAMILY_MEMBER", "OTHER"]).optional(),
      customLabel: z.string().min(1).optional(),
    })
    .optional(),
});

const reviewSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().optional(),
});

function canUpload(role?: string) {
  return role === "ADMIN"
    || role === "MANAGER"
    || role === "COUNSELLOR"
    || role === "SUB_AGENT"
    || role === "STUDENT"
    || role === "BRANCH_MANAGER"
    || role === "SUB_AGENT_COUNSELLOR";
}

function canReview(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR";
}

const DOC_TYPE_BY_KEY: Record<z.infer<typeof payloadSchema>["key"], "PASSPORT" | "TRANSCRIPT" | "ENGLISH_TEST" | "VISA_DOCUMENT" | "PERSONAL_STATEMENT" | "FINANCIAL_PROOF"> = {
  PASSPORT: "PASSPORT",
  ACADEMIC: "TRANSCRIPT",
  ENGLISH_TEST: "ENGLISH_TEST",
  TB_TEST: "VISA_DOCUMENT",
  POST_STUDY_PLAN: "PERSONAL_STATEMENT",
  SOURCE_OF_FUNDS: "FINANCIAL_PROOF",
  SOURCE_OF_FUNDS_EVIDENCE: "FINANCIAL_PROOF",
  PARENT_ID_DOCUMENT: "FINANCIAL_PROOF",
  BIRTH_CERTIFICATE: "FINANCIAL_PROOF",
  DECLARATION_LETTER: "FINANCIAL_PROOF",
  SPONSOR_ID_DOCUMENT: "FINANCIAL_PROOF",
  SPONSORSHIP_DECLARATION_LETTER: "FINANCIAL_PROOF",
  SPONSORSHIP_CONFIRMATION_LETTER: "FINANCIAL_PROOF",
  SCHOLARSHIP_LETTER: "FINANCIAL_PROOF",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canUpload(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            assignedCounsellorId: true,
            subAgent: { select: { userId: true } },
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (session.user.roleName === "COUNSELLOR" && application.student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "SUB_AGENT" && application.student.subAgent?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "STUDENT" && application.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documentType = DOC_TYPE_BY_KEY[parsed.data.key];

    const document = await db.document.create({
      data: {
        studentId: application.student.id,
        applicationId: application.id,
        type: documentType,
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    const checklist = await db.documentChecklist.findFirst({
      where: { applicationId: application.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            documentType: true,
            label: true,
            documentId: true,
          },
        },
      },
    });

    let targetChecklistItemId: string | null = null;

    if (checklist?.items?.length) {
      const checklistItems = checklist.items;
      const lower = (v: string) => v.toLowerCase();
      const pickEmpty = (filter: (item: (typeof checklistItems)[number]) => boolean) =>
        checklistItems.find((item) => filter(item) && !item.documentId) || checklistItems.find((item) => filter(item));

      const target =
        parsed.data.key === "PASSPORT"
          ? pickEmpty((item) => item.documentType === "PASSPORT")
          : parsed.data.key === "ACADEMIC"
            ? pickEmpty((item) => item.documentType === "TRANSCRIPT" || item.documentType === "DEGREE_CERT")
            : parsed.data.key === "ENGLISH_TEST"
              ? pickEmpty((item) => item.documentType === "ENGLISH_TEST")
              : parsed.data.key === "TB_TEST"
                ? pickEmpty((item) => item.documentType === "VISA_DOCUMENT" && (lower(item.label).includes("tb") || lower(item.label).includes("tuberculosis")))
                : parsed.data.key === "POST_STUDY_PLAN"
                  ? pickEmpty((item) => item.documentType === "PERSONAL_STATEMENT" || item.documentType === "SOP" || item.documentType === "COVER_LETTER")
                  : null;

      if (target) {
        targetChecklistItemId = target.id;

        await db.checklistItem.update({
          where: { id: target.id },
          data: {
            documentId: document.id,
            status: "UPLOADED",
            ocrStatus: "PENDING",
            fraudRiskLevel: "UNKNOWN",
            fraudFlags: [],
            ocrConfidence: null,
          },
        });

        void runDocumentScan(target.id).catch((error) => {
          console.error(`runDocumentScan failed for checklist item ${target.id}`, error);
        });
      }
    }

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "finance_general_document_uploaded",
        details: JSON.stringify({
          key: parsed.data.key,
          documentId: document.id,
          checklistItemId: targetChecklistItemId,
          fileName: parsed.data.fileName,
          fileUrl: parsed.data.fileUrl,
          context: parsed.data.context || null,
          uploadedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({ data: { documentId: document.id, checklistItemId: targetChecklistItemId } }, { status: 201 });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/general-documents POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canReview(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const document = await db.document.findUnique({
      where: { id: parsed.data.documentId },
      select: { id: true, applicationId: true },
    });

    if (!document || document.applicationId !== application.id) {
      return NextResponse.json({ error: "Document not found for this application" }, { status: 404 });
    }

    const status = parsed.data.decision === "APPROVE" ? "VERIFIED" : "REJECTED";

    await db.document.update({
      where: { id: document.id },
      data: { status },
    });

    await db.checklistItem.updateMany({
      where: { documentId: document.id },
      data: {
        status,
        verifiedBy: parsed.data.decision === "APPROVE" ? session.user.id : null,
        verifiedAt: parsed.data.decision === "APPROVE" ? new Date() : null,
      },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "application",
        entityId: application.id,
        action: "finance_general_document_reviewed",
        details: JSON.stringify({
          documentId: document.id,
          decision: parsed.data.decision,
          status,
          note: parsed.data.note || null,
          reviewedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({ data: { documentId: document.id, status } });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/general-documents PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
