import { stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { DocumentType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toApiFilesPath } from "@/lib/file-url";
import { localUploadKeyFromUrl, removeUploadByUrl } from "@/lib/local-upload";
import { NotificationService } from "@/lib/notifications";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads");

type SmartItemStatus = "TODO" | "UPLOADED" | "VERIFIED" | "NEEDS_REVISION";
type UploadedStatus = "PENDING" | "SCANNING" | "VERIFIED" | "REVISION_REQUIRED" | "REJECTED";
type DeleteSourceType = "DOCUMENT" | "TEST_SCORE" | "WRITTEN_DOCUMENT";

type DeleteTarget = {
  sourceType: DeleteSourceType;
  sourceId: string;
};

type SmartItem = {
  id: string;
  requestId?: string | null;
  qualificationId?: string | null;
  label: string;
  documentType: string;
  itemKind: string;
  status: SmartItemStatus;
  hasFile: boolean;
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  requestedByName?: string | null;
  requestedByRole?: string | null;
  staffNote?: string | null;
  deleteTarget?: DeleteTarget | null;
};

async function fileSizeByUrl(fileUrl: string | null) {
  if (!fileUrl) return null;
  const key = localUploadKeyFromUrl(toApiFilesPath(fileUrl));
  if (!key) return null;

  const cleanKey = path.basename(decodeURIComponent(key));
  const candidates = [
    path.join(STORAGE_ROOT, cleanKey),
    path.join(PUBLIC_ROOT, cleanKey),
  ];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return info.size;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesToken(value: string | null | undefined, token: string) {
  if (!value) return false;
  return normalizeText(value).includes(normalizeText(token));
}

function qualificationLabel(qualType: string, qualName: string | null) {
  const type = qualType.toUpperCase();
  if (type === "SSC") return "SSC";
  if (type === "HSC") return "HSC";
  if (type === "O_LEVEL") return "O-Level";
  if (type === "A_LEVEL") return "A-Level";
  if (type === "GCSE") return "GCSE";
  if (type === "IGCSE") return "IGCSE";
  if (type === "DIPLOMA") return "Diploma";

  const name = (qualName || "").toUpperCase();
  if (name.includes("BACHELOR")) return "Bachelor Degree";
  if (name.includes("MASTER")) return "Master Degree";
  if (name.includes("PHD") || name.includes("DOCTOR")) return "PhD";
  return qualName || qualType.replaceAll("_", " ");
}

function itemStatusFromDocument(doc: {
  status: string;
  scanResult?: { status: string; counsellorDecision: string | null } | null;
} | null): SmartItemStatus {
  if (!doc) return "TODO";
  const decision = doc.scanResult?.counsellorDecision || null;
  const scanStatus = doc.scanResult?.status || null;
  if (doc.status === "VERIFIED" || decision === "ACCEPTED") return "VERIFIED";
  if (doc.status === "REJECTED" || decision === "REJECTED" || decision === "REVISION_REQUIRED") return "NEEDS_REVISION";
  if (scanStatus === "SCANNING" || doc.status === "PENDING") return "UPLOADED";
  return "UPLOADED";
}

function itemStatusFromRequest(request: {
  status: string;
  verificationStatus: string;
  uploadedFileUrl: string | null;
}): SmartItemStatus {
  const status = request.status.toUpperCase();
  const verification = request.verificationStatus.toUpperCase();
  if (status === "VERIFIED" || verification === "VERIFIED") return "VERIFIED";
  if (status === "NEEDS_REVISION" || verification === "NEEDS_REVISION") return "NEEDS_REVISION";
  if (request.uploadedFileUrl) return "UPLOADED";
  return "TODO";
}

function uploadedStatusLabel(status: string, scanDecision: string | null, scanStatus: string | null): UploadedStatus {
  if (scanDecision === "ACCEPTED" || status === "VERIFIED") return "VERIFIED";
  if (scanDecision === "REJECTED" || status === "REJECTED") return "REJECTED";
  if (scanDecision === "REVISION_REQUIRED") return "REVISION_REQUIRED";
  if (scanStatus === "SCANNING") return "SCANNING";
  return "PENDING";
}

async function maybeNotifyFileReady(input: {
  studentId: string;
  studentName: string;
  assignedCounsellorId: string | null;
  subAgentUserId: string | null;
}) {
  const existing = await db.activityLog.findFirst({
    where: {
      entityType: "student",
      entityId: input.studentId,
      action: "smart_file_ready_notified",
    },
    select: { id: true },
  });

  if (existing) return;

  const targetUserIds = new Set<string>();
  if (input.assignedCounsellorId) targetUserIds.add(input.assignedCounsellorId);
  if (input.subAgentUserId) targetUserIds.add(input.subAgentUserId);

  const adminAndManager = await db.user.findMany({
    where: { role: { name: { in: ["ADMIN", "MANAGER"] } } },
    select: { id: true },
    take: 30,
  });
  for (const user of adminAndManager) targetUserIds.add(user.id);

  for (const userId of Array.from(targetUserIds)) {
    await NotificationService.createNotification({
      userId,
      type: "DOCUMENT_FILE_READY",
      message: `${input.studentName}'s file is complete and ready to apply.`,
      linkUrl: `/dashboard/students/${input.studentId}`,
    }).catch(() => undefined);
  }

  await db.activityLog.create({
    data: {
      userId: input.assignedCounsellorId || input.subAgentUserId || Array.from(targetUserIds)[0] || "system",
      entityType: "student",
      entityId: input.studentId,
      action: "smart_file_ready_notified",
      details: "Automatic notification sent after all smart checklist items were verified.",
    },
  }).catch(() => undefined);
}

async function resolveStudent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), student: null };
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedCounsellorId: true,
      subAgent: { select: { userId: true } },
      passportNumber: true,
      passportExpiry: true,
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          fileUrl: true,
          uploadedAt: true,
          status: true,
          scanResult: {
            select: {
              status: true,
              counsellorDecision: true,
            },
          },
        },
      },
      academicProfile: {
        select: {
          qualifications: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              qualType: true,
              qualName: true,
              transcriptDoc: {
                select: {
                  id: true,
                  fileName: true,
                  fileUrl: true,
                  uploadedAt: true,
                  status: true,
                  scanResult: {
                    select: {
                      status: true,
                      counsellorDecision: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      testScores: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          testType: true,
          certificateUrl: true,
          certificateFileName: true,
          isVerified: true,
          createdAt: true,
        },
      },
      applications: {
        select: {
          id: true,
          course: { select: { level: true } },
          university: { select: { country: true } },
        },
      },
      writtenDocuments: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          documentType: true,
          status: true,
          convertedPdfUrl: true,
          updatedAt: true,
        },
      },
      cvProfile: {
        select: {
          id: true,
          isComplete: true,
          profileSummary: true,
          updatedAt: true,
        },
      },
      documentRequests: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          documentType: true,
          documentLabel: true,
          customLabel: true,
          notes: true,
          requestedByName: true,
          requestedByRole: true,
          status: true,
          uploadedFileUrl: true,
          uploadedFileName: true,
          uploadedAt: true,
          verificationStatus: true,
          revisionNote: true,
          uploadedDocumentId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!student) {
    return { error: NextResponse.json({ error: "Student not found" }, { status: 404 }), student: null };
  }

  return { error: null, student };
}

export async function GET() {
  const resolved = await resolveStudent();
  if (resolved.error || !resolved.student) {
    return resolved.error as NextResponse;
  }

  const student = resolved.student;
  const studentDocuments = student.documents;
  const docsByType = new Map<DocumentType, typeof studentDocuments>();
  for (const doc of studentDocuments) {
    const list = docsByType.get(doc.type) || [];
    list.push(doc);
    docsByType.set(doc.type, list);
  }

  const latestByType = (type: DocumentType) => (docsByType.get(type) || [])[0] || null;
  const firstByTypeMatching = (type: DocumentType, matcher: (doc: (typeof studentDocuments)[number]) => boolean) => {
    const list = docsByType.get(type) || [];
    return list.find(matcher) || null;
  };

  const passportDoc = latestByType(DocumentType.PASSPORT);
  const qualifications = (student.academicProfile?.qualifications || []).map((qualification) => {
    const labelPrefix = qualificationLabel(qualification.qualType, qualification.qualName);
    const certificateDoc = firstByTypeMatching(DocumentType.DEGREE_CERT, (doc) =>
      matchesToken(doc.fileName, labelPrefix) || matchesToken(doc.fileName, qualification.qualName || ""),
    );

    return {
      id: qualification.id,
      qualType: qualification.qualType,
      qualName: qualification.qualName,
      transcriptFileUrl: qualification.transcriptDoc ? toApiFilesPath(qualification.transcriptDoc.fileUrl) : null,
      transcriptFileName: qualification.transcriptDoc?.fileName || null,
      certificateFileUrl: certificateDoc ? toApiFilesPath(certificateDoc.fileUrl) : null,
      certificateFileName: certificateDoc?.fileName || null,
    };
  });

  const rawTestScores = student.testScores.map((score) => ({
    id: score.id,
    testType: score.testType,
    certificateUrl: score.certificateUrl ? toApiFilesPath(score.certificateUrl) : null,
    certificateFileName: score.certificateFileName || null,
    isVerified: score.isVerified,
    createdAt: score.createdAt.toISOString(),
  }));

  const smartChecklist: SmartItem[] = [];
  smartChecklist.push({
    id: "auto-passport",
    label: "Passport",
    documentType: "PASSPORT",
    itemKind: "PASSPORT",
    status: passportDoc ? itemStatusFromDocument(passportDoc) : "TODO",
    hasFile: Boolean(passportDoc),
    fileUrl: passportDoc ? toApiFilesPath(passportDoc.fileUrl) : null,
    fileName: passportDoc?.fileName || null,
    uploadedAt: passportDoc?.uploadedAt.toISOString() || null,
    deleteTarget: passportDoc ? { sourceType: "DOCUMENT", sourceId: passportDoc.id } : null,
  });

  for (const qualification of student.academicProfile?.qualifications || []) {
    const labelPrefix = qualificationLabel(qualification.qualType, qualification.qualName);
    const transcriptDoc = qualification.transcriptDoc;
    const certificateDoc = firstByTypeMatching(DocumentType.DEGREE_CERT, (doc) =>
      matchesToken(doc.fileName, labelPrefix) || matchesToken(doc.fileName, qualification.qualName || ""),
    );

    smartChecklist.push({
      id: `auto-qual-transcript-${qualification.id}`,
      qualificationId: qualification.id,
      label: `${labelPrefix} Transcript`,
      documentType: "TRANSCRIPT",
      itemKind: "QUALIFICATION_TRANSCRIPT",
      status: transcriptDoc ? itemStatusFromDocument(transcriptDoc) : "TODO",
      hasFile: Boolean(transcriptDoc),
      fileUrl: transcriptDoc ? toApiFilesPath(transcriptDoc.fileUrl) : null,
      fileName: transcriptDoc?.fileName || null,
      uploadedAt: transcriptDoc?.uploadedAt.toISOString() || null,
      deleteTarget: transcriptDoc ? { sourceType: "DOCUMENT", sourceId: transcriptDoc.id } : null,
    });

    smartChecklist.push({
      id: `auto-qual-certificate-${qualification.id}`,
      qualificationId: qualification.id,
      label: `${labelPrefix} Certificate`,
      documentType: "DEGREE_CERT",
      itemKind: "QUALIFICATION_CERTIFICATE",
      status: certificateDoc ? itemStatusFromDocument(certificateDoc) : "TODO",
      hasFile: Boolean(certificateDoc),
      fileUrl: certificateDoc ? toApiFilesPath(certificateDoc.fileUrl) : null,
      fileName: certificateDoc?.fileName || null,
      uploadedAt: certificateDoc?.uploadedAt.toISOString() || null,
      deleteTarget: certificateDoc ? { sourceType: "DOCUMENT", sourceId: certificateDoc.id } : null,
    });
  }

  for (const testScore of student.testScores) {
    const testTypeRaw = testScore.testType || "English Test";
    const linkedDoc = testScore.certificateUrl
      ? null
      : firstByTypeMatching(DocumentType.ENGLISH_TEST, (doc) => matchesToken(doc.fileName, testTypeRaw));
    const fileUrl = testScore.certificateUrl ? toApiFilesPath(testScore.certificateUrl) : (linkedDoc ? toApiFilesPath(linkedDoc.fileUrl) : null);
    const fileName = testScore.certificateFileName || linkedDoc?.fileName || `${testTypeRaw} Certificate`;

    smartChecklist.push({
      id: `auto-test-${testScore.id}`,
      label: `${testTypeRaw} Certificate`,
      documentType: "ENGLISH_TEST",
      itemKind: "TEST_CERTIFICATE",
      status: testScore.isVerified ? "VERIFIED" : (fileUrl ? "UPLOADED" : "TODO"),
      hasFile: Boolean(fileUrl),
      fileUrl,
      fileName,
      uploadedAt: linkedDoc?.uploadedAt.toISOString() || testScore.createdAt.toISOString(),
      deleteTarget: fileUrl
        ? (linkedDoc ? { sourceType: "DOCUMENT", sourceId: linkedDoc.id } : { sourceType: "TEST_SCORE", sourceId: testScore.id })
        : null,
    });
  }

  const levels = student.applications.map((app) => app.course.level);
  const highestLevel = levels.includes("PHD") ? "PHD" : levels.includes("MASTERS") ? "MASTERS" : levels.includes("BACHELORS") ? "BACHELORS" : null;
  const lorDocs = docsByType.get(DocumentType.LOR) || [];
  const requiredReferences = highestLevel === "PHD" || highestLevel === "MASTERS" ? 2 : highestLevel === "BACHELORS" ? 1 : 0;
  for (let index = 0; index < requiredReferences; index += 1) {
    const doc = lorDocs[index] || null;
    smartChecklist.push({
      id: `auto-reference-${index + 1}`,
      label: requiredReferences === 1 ? "Reference Letter" : `Reference Letter ${index + 1}`,
      documentType: "LOR",
      itemKind: "REFERENCE_LETTER",
      status: doc ? itemStatusFromDocument(doc) : "TODO",
      hasFile: Boolean(doc),
      fileUrl: doc ? toApiFilesPath(doc.fileUrl) : null,
      fileName: doc?.fileName || null,
      uploadedAt: doc?.uploadedAt.toISOString() || null,
      deleteTarget: doc ? { sourceType: "DOCUMENT", sourceId: doc.id } : null,
    });
  }

  const sopDoc = latestByType(DocumentType.SOP) || latestByType(DocumentType.PERSONAL_STATEMENT);
  const writtenDoc = student.writtenDocuments[0] || null;
  smartChecklist.push({
    id: "auto-sop",
    label: "Personal Statement / SOP",
    documentType: "SOP",
    itemKind: "SOP",
    status: sopDoc ? itemStatusFromDocument(sopDoc) : (writtenDoc?.convertedPdfUrl ? "UPLOADED" : "TODO"),
    hasFile: Boolean(sopDoc || writtenDoc?.convertedPdfUrl),
    fileUrl: sopDoc ? toApiFilesPath(sopDoc.fileUrl) : (writtenDoc?.convertedPdfUrl ? toApiFilesPath(writtenDoc.convertedPdfUrl) : null),
    fileName: sopDoc?.fileName || writtenDoc?.title || null,
    uploadedAt: sopDoc?.uploadedAt.toISOString() || writtenDoc?.updatedAt.toISOString() || null,
    deleteTarget: sopDoc
      ? { sourceType: "DOCUMENT", sourceId: sopDoc.id }
      : (writtenDoc?.convertedPdfUrl ? { sourceType: "WRITTEN_DOCUMENT", sourceId: writtenDoc.id } : null),
  });

  const cvDoc = latestByType(DocumentType.CV);
  const hasCvContent = Boolean(student.cvProfile?.isComplete || student.cvProfile?.profileSummary);
  smartChecklist.push({
    id: "auto-cv",
    label: "CV / Resume",
    documentType: "CV",
    itemKind: "CV",
    status: cvDoc ? itemStatusFromDocument(cvDoc) : (hasCvContent ? "UPLOADED" : "TODO"),
    hasFile: Boolean(cvDoc || hasCvContent),
    fileUrl: cvDoc ? toApiFilesPath(cvDoc.fileUrl) : null,
    fileName: cvDoc?.fileName || (hasCvContent ? "CV Builder Profile" : null),
    uploadedAt: cvDoc?.uploadedAt.toISOString() || student.cvProfile?.updatedAt.toISOString() || null,
    deleteTarget: cvDoc ? { sourceType: "DOCUMENT", sourceId: cvDoc.id } : null,
  });

  if (student.applications.length > 0) {
    const bankStatementDoc = firstByTypeMatching(DocumentType.FINANCIAL_PROOF, (doc) => matchesToken(doc.fileName, "bank") || matchesToken(doc.fileName, "statement")) || latestByType(DocumentType.FINANCIAL_PROOF);
    smartChecklist.push({
      id: "auto-bank-statement",
      label: "Bank Statement",
      documentType: "FINANCIAL_PROOF",
      itemKind: "BANK_STATEMENT",
      status: bankStatementDoc ? itemStatusFromDocument(bankStatementDoc) : "TODO",
      hasFile: Boolean(bankStatementDoc),
      fileUrl: bankStatementDoc ? toApiFilesPath(bankStatementDoc.fileUrl) : null,
      fileName: bankStatementDoc?.fileName || null,
      uploadedAt: bankStatementDoc?.uploadedAt.toISOString() || null,
      deleteTarget: bankStatementDoc ? { sourceType: "DOCUMENT", sourceId: bankStatementDoc.id } : null,
    });
  }

  const countries = Array.from(new Set(student.applications.map((app) => app.university.country.toUpperCase())));
  const visaDoc = latestByType(DocumentType.VISA_DOCUMENT);
  if (countries.some((country) => country.includes("UK") || country.includes("UNITED KINGDOM") || country === "GB")) {
    smartChecklist.push({
      id: "auto-uk-tb",
      label: "Tuberculosis (TB) Test Certificate",
      documentType: "VISA_DOCUMENT",
      itemKind: "TB_CERTIFICATE",
      status: visaDoc ? itemStatusFromDocument(visaDoc) : "TODO",
      hasFile: Boolean(visaDoc),
      fileUrl: visaDoc ? toApiFilesPath(visaDoc.fileUrl) : null,
      fileName: visaDoc?.fileName || null,
      uploadedAt: visaDoc?.uploadedAt.toISOString() || null,
      staffNote: "Required for some UK-bound students based on nationality and visa rules.",
      deleteTarget: visaDoc ? { sourceType: "DOCUMENT", sourceId: visaDoc.id } : null,
    });
  }
  if (countries.some((country) => country.includes("CANADA"))) {
    const fundsDoc = firstByTypeMatching(DocumentType.FINANCIAL_PROOF, (doc) => matchesToken(doc.fileName, "fund")) || latestByType(DocumentType.FINANCIAL_PROOF);
    smartChecklist.push({
      id: "auto-canada-funds",
      label: "Proof of Funds",
      documentType: "FINANCIAL_PROOF",
      itemKind: "PROOF_OF_FUNDS",
      status: fundsDoc ? itemStatusFromDocument(fundsDoc) : "TODO",
      hasFile: Boolean(fundsDoc),
      fileUrl: fundsDoc ? toApiFilesPath(fundsDoc.fileUrl) : null,
      fileName: fundsDoc?.fileName || null,
      uploadedAt: fundsDoc?.uploadedAt.toISOString() || null,
      deleteTarget: fundsDoc ? { sourceType: "DOCUMENT", sourceId: fundsDoc.id } : null,
    });
  }
  if (countries.some((country) => country.includes("AUSTRALIA"))) {
    smartChecklist.push({
      id: "auto-australia-oshc",
      label: "OSHC Evidence",
      documentType: "VISA_DOCUMENT",
      itemKind: "OSHC",
      status: visaDoc ? itemStatusFromDocument(visaDoc) : "TODO",
      hasFile: Boolean(visaDoc),
      fileUrl: visaDoc ? toApiFilesPath(visaDoc.fileUrl) : null,
      fileName: visaDoc?.fileName || null,
      uploadedAt: visaDoc?.uploadedAt.toISOString() || null,
      deleteTarget: visaDoc ? { sourceType: "DOCUMENT", sourceId: visaDoc.id } : null,
    });
  }
  if (countries.some((country) => country.includes("USA") || country.includes("UNITED STATES"))) {
    const affidavit = firstByTypeMatching(DocumentType.FINANCIAL_PROOF, (doc) => matchesToken(doc.fileName, "affidavit")) || latestByType(DocumentType.FINANCIAL_PROOF);
    smartChecklist.push({
      id: "auto-usa-affidavit",
      label: "Financial Affidavit",
      documentType: "FINANCIAL_PROOF",
      itemKind: "FINANCIAL_AFFIDAVIT",
      status: affidavit ? itemStatusFromDocument(affidavit) : "TODO",
      hasFile: Boolean(affidavit),
      fileUrl: affidavit ? toApiFilesPath(affidavit.fileUrl) : null,
      fileName: affidavit?.fileName || null,
      uploadedAt: affidavit?.uploadedAt.toISOString() || null,
      deleteTarget: affidavit ? { sourceType: "DOCUMENT", sourceId: affidavit.id } : null,
    });
  }

  for (const request of student.documentRequests) {
    smartChecklist.push({
      id: `request-${request.id}`,
      requestId: request.id,
      label: request.customLabel || request.documentLabel,
      documentType: request.documentType,
      itemKind: "STAFF_REQUESTED",
      status: itemStatusFromRequest(request),
      hasFile: Boolean(request.uploadedFileUrl),
      fileUrl: request.uploadedFileUrl ? toApiFilesPath(request.uploadedFileUrl) : null,
      fileName: request.uploadedFileName || null,
      uploadedAt: request.uploadedAt?.toISOString() || null,
      requestedByName: request.requestedByName,
      requestedByRole: request.requestedByRole,
      staffNote: request.revisionNote || request.notes,
      deleteTarget: request.uploadedDocumentId ? { sourceType: "DOCUMENT", sourceId: request.uploadedDocumentId } : null,
    });
  }

  const totalRequired = smartChecklist.length;
  const verifiedCount = smartChecklist.filter((item) => item.status === "VERIFIED").length;
  const pendingReviewCount = smartChecklist.filter((item) => item.status === "UPLOADED").length;
  const needsRevisionCount = smartChecklist.filter((item) => item.status === "NEEDS_REVISION").length;
  const stillRequiredCount = smartChecklist.filter((item) => item.status === "TODO").length;

  let readyBanner: "AWAITING_VERIFICATION" | "READY_TO_APPLY" | null = null;
  if (stillRequiredCount === 0 && pendingReviewCount > 0) readyBanner = "AWAITING_VERIFICATION";
  if (totalRequired > 0 && verifiedCount === totalRequired) {
    readyBanner = "READY_TO_APPLY";
    await maybeNotifyFileReady({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      assignedCounsellorId: student.assignedCounsellorId,
      subAgentUserId: student.subAgent?.userId || null,
    });
  }

  const uploadedDocuments = await Promise.all(student.documents.map(async (doc) => ({
    id: doc.id,
    documentName: doc.fileName,
    documentType: doc.type,
    fileUrl: toApiFilesPath(doc.fileUrl),
    uploadedAt: doc.uploadedAt.toISOString(),
    fileSize: await fileSizeByUrl(doc.fileUrl),
    status: uploadedStatusLabel(doc.status, doc.scanResult?.counsellorDecision || null, doc.scanResult?.status || null),
    source: "DOCUMENT_VAULT",
    deleteTarget: { sourceType: "DOCUMENT", sourceId: doc.id },
  })));

  const testScoreUploads = await Promise.all(student.testScores.filter((score) => Boolean(score.certificateUrl)).map(async (score) => ({
    id: `test-score-${score.id}`,
    documentName: score.certificateFileName || `${score.testType} Certificate`,
    documentType: "ENGLISH_TEST",
    fileUrl: toApiFilesPath(score.certificateUrl),
    uploadedAt: score.createdAt.toISOString(),
    fileSize: await fileSizeByUrl(score.certificateUrl),
    status: score.isVerified ? "VERIFIED" as const : "PENDING" as const,
    source: "TEST_SCORE",
    deleteTarget: { sourceType: "TEST_SCORE" as const, sourceId: score.id },
  })));

  const writtenUploads = await Promise.all(student.writtenDocuments.filter((written) => Boolean(written.convertedPdfUrl)).map(async (written) => ({
    id: `written-${written.id}`,
    documentName: written.title,
    documentType: written.documentType,
    fileUrl: toApiFilesPath(written.convertedPdfUrl),
    uploadedAt: written.updatedAt.toISOString(),
    fileSize: await fileSizeByUrl(written.convertedPdfUrl),
    status: written.status === "APPROVED" ? "VERIFIED" as const : "PENDING" as const,
    source: "WRITTEN_DOCUMENT",
    deleteTarget: { sourceType: "WRITTEN_DOCUMENT" as const, sourceId: written.id },
  })));

  return NextResponse.json({
    data: {
      studentId: student.id,
      passportFileUrl: passportDoc ? toApiFilesPath(passportDoc.fileUrl) : null,
      qualifications,
      testScores: rawTestScores,
      documentRequests: student.documentRequests.map((request) => ({
        id: request.id,
        documentType: request.documentType,
        documentLabel: request.documentLabel,
        customLabel: request.customLabel,
        notes: request.notes,
        requestedByName: request.requestedByName,
        requestedByRole: request.requestedByRole,
        status: request.status,
        verificationStatus: request.verificationStatus,
        uploadedFileUrl: request.uploadedFileUrl ? toApiFilesPath(request.uploadedFileUrl) : null,
        uploadedFileName: request.uploadedFileName,
        uploadedAt: request.uploadedAt?.toISOString() || null,
        revisionNote: request.revisionNote,
      })),
      uploadedDocuments: [...uploadedDocuments, ...testScoreUploads, ...writtenUploads],
      requiredChecklist: smartChecklist,
      verifiedCount,
      totalRequired,
      pendingReviewCount,
      needsRevisionCount,
      stillRequiredCount,
      readyBanner,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const resolved = await resolveStudent();
  if (resolved.error || !resolved.student) {
    return resolved.error as NextResponse;
  }

  const body = await request.json().catch(() => null) as { sourceType?: string; sourceId?: string } | null;
  const sourceType = String(body?.sourceType || "").trim().toUpperCase();
  const sourceId = String(body?.sourceId || "").trim();
  if (!sourceType || !sourceId) {
    return NextResponse.json({ error: "sourceType and sourceId are required" }, { status: 400 });
  }

  const studentId = resolved.student.id;

  if (sourceType === "DOCUMENT") {
    const document = await db.document.findFirst({
      where: { id: sourceId, studentId },
      select: { id: true, fileUrl: true },
    });
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await db.$transaction(async (tx) => {
      await tx.checklistItem.updateMany({
        where: { documentId: document.id },
        data: { documentId: null, status: "PENDING" },
      });
      await tx.studentQualification.updateMany({
        where: { transcriptDocId: document.id, academicProfile: { studentId } },
        data: { transcriptDocId: null },
      });
      await tx.documentRequest.updateMany({
        where: { studentId, uploadedDocumentId: document.id },
        data: {
          uploadedDocumentId: null,
          uploadedFileUrl: null,
          uploadedFileName: null,
          uploadedAt: null,
          verifiedBy: null,
          verifiedAt: null,
          verificationStatus: "PENDING",
          status: "PENDING",
        },
      });
      await tx.documentScanResult.deleteMany({ where: { documentId: document.id } });
      await tx.document.delete({ where: { id: document.id } });
    });

    await removeUploadByUrl(document.fileUrl).catch(() => undefined);
    return NextResponse.json({ data: { ok: true } });
  }

  if (sourceType === "TEST_SCORE") {
    const row = await db.studentTestScore.findFirst({
      where: { id: sourceId, studentId },
      select: { certificateUrl: true },
    });
    if (!row) return NextResponse.json({ error: "Test score certificate not found" }, { status: 404 });
    await db.studentTestScore.update({
      where: { id: sourceId },
      data: {
        certificateUrl: null,
        certificateFileName: null,
        isVerified: false,
      },
    });
    if (row.certificateUrl) {
      await removeUploadByUrl(row.certificateUrl).catch(() => undefined);
    }
    return NextResponse.json({ data: { ok: true } });
  }

  if (sourceType === "WRITTEN_DOCUMENT") {
    const row = await db.studentDocument.findFirst({
      where: { id: sourceId, studentId },
      select: { convertedPdfUrl: true },
    });
    if (!row) return NextResponse.json({ error: "Written document not found" }, { status: 404 });
    await db.studentDocument.update({
      where: { id: sourceId },
      data: {
        convertedPdfUrl: null,
        status: "DRAFT",
      },
    });
    if (row.convertedPdfUrl) {
      await removeUploadByUrl(row.convertedPdfUrl).catch(() => undefined);
    }
    return NextResponse.json({ data: { ok: true } });
  }

  return NextResponse.json({ error: "Unsupported sourceType" }, { status: 400 });
}