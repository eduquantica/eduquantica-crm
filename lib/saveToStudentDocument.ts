import { DocumentType } from "@prisma/client";
import { db } from "@/lib/db";

function mapDocumentType(value: string): { type: DocumentType; prefix: string } {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "PASSPORT") return { type: DocumentType.PASSPORT, prefix: "" };
  if (normalized === "CV") return { type: DocumentType.CV, prefix: "" };
  if (normalized === "SOP") return { type: DocumentType.SOP, prefix: "" };
  if (normalized === "PERSONAL_STATEMENT") return { type: DocumentType.PERSONAL_STATEMENT, prefix: "" };
  if (normalized === "COVER_LETTER") return { type: DocumentType.COVER_LETTER, prefix: "" };
  if (normalized === "TRANSCRIPT") return { type: DocumentType.TRANSCRIPT, prefix: "" };
  if (normalized === "DEGREE_CERTIFICATE" || normalized === "DEGREE_CERT") {
    return { type: DocumentType.DEGREE_CERT, prefix: "" };
  }

  if (
    normalized === "IELTS_CERTIFICATE"
    || normalized === "TOEFL_CERTIFICATE"
    || normalized === "PTE_CERTIFICATE"
    || normalized === "DUOLINGO_CERTIFICATE"
    || normalized === "OET_CERTIFICATE"
    || normalized === "ENGLISH_TEST"
  ) {
    return { type: DocumentType.ENGLISH_TEST, prefix: `${normalized}: ` };
  }

  if (normalized === "DEPOSIT_RECEIPT") {
    return { type: DocumentType.FINANCIAL_PROOF, prefix: "DEPOSIT_RECEIPT: " };
  }

  if (normalized === "BANK_STATEMENT") {
    return { type: DocumentType.FINANCIAL_PROOF, prefix: "BANK_STATEMENT: " };
  }

  if (normalized === "OFFER_LETTER") {
    return { type: DocumentType.OTHER, prefix: "OFFER_LETTER: " };
  }

  return { type: DocumentType.OTHER, prefix: `${normalized || "DOCUMENT"}: ` };
}

export async function saveToStudentDocument(
  studentId: string,
  documentType: string,
  fileUrl: string,
  fileName: string,
  uploadedBy: string,
  qualificationId?: string,
) {
  const { type, prefix } = mapDocumentType(documentType);
  const qualificationPrefix = qualificationId ? `qualification:${qualificationId}: ` : "";
  const storedFileName = `${qualificationPrefix}${prefix}${fileName}`;

  const existing = await db.document.findFirst({
    where: {
      studentId,
      type,
      ...(qualificationId
        ? { fileName: { startsWith: qualificationPrefix } }
        : prefix
          ? { fileName: { startsWith: prefix } }
          : {}),
    },
    orderBy: { uploadedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    return db.document.update({
      where: { id: existing.id },
      data: {
        fileName: storedFileName,
        fileUrl,
        status: "PENDING",
      },
    });
  }

  return db.document.create({
    data: {
      studentId,
      type,
      fileName: storedFileName,
      fileUrl,
      status: "PENDING",
    },
  });
}
