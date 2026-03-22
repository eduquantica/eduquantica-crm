import { DocumentType } from "@prisma/client";

export type ChecklistUiStatus =
  | "PENDING"
  | "SCANNING"
  | "REVISION_REQUIRED"
  | "VERIFIED"
  | "REJECTED";

export type ChecklistUiItem = {
  id: string;
  label: string;
  documentType: DocumentType;
  status: ChecklistUiStatus;
  reason: string | null;
  ocrStatus: string | null;
  ocrData: unknown;
  ocrConfidence: number | null;
  fileName: string | null;
  fileUrl: string | null;
};

type ChecklistItemSource = {
  id: string;
  label: string;
  documentType: DocumentType;
  status: string;
  counsellorNote: string | null;
  ocrStatus: string | null;
  ocrData: unknown;
  ocrConfidence: number | null;
  document: {
    fileName: string;
    fileUrl: string;
    scanResult: {
      status: string;
      counsellorDecision: string | null;
      counsellorNote: string | null;
    } | null;
  } | null;
};

export function resolveChecklistUiStatus(item: ChecklistItemSource): {
  status: ChecklistUiStatus;
  reason: string | null;
} {
  if (!item.document) return { status: "PENDING", reason: null };

  if (item.ocrStatus === "SCANNING" || item.document.scanResult?.status === "SCANNING") {
    return { status: "SCANNING", reason: null };
  }

  if (item.document.scanResult?.counsellorDecision === "REVISION_REQUIRED") {
    return {
      status: "REVISION_REQUIRED",
      reason: item.document.scanResult.counsellorNote || item.counsellorNote || "Please revise and resubmit this document.",
    };
  }

  if (item.status === "REJECTED" || item.document.scanResult?.counsellorDecision === "REJECTED") {
    return {
      status: "REJECTED",
      reason: item.document.scanResult?.counsellorNote || item.counsellorNote || "Document rejected by counsellor.",
    };
  }

  if (item.status === "VERIFIED" || item.document.scanResult?.counsellorDecision === "ACCEPTED") {
    return { status: "VERIFIED", reason: null };
  }

  return { status: "PENDING", reason: null };
}

export function getDocumentInstructions(documentType: DocumentType): {
  instructions: string;
  exampleImage: string;
} {
  const map: Record<DocumentType, { instructions: string; exampleImage: string }> = {
    PASSPORT: {
      instructions:
        "Upload a clear full-page passport image. Ensure MRZ lines are visible, no glare, and all text is readable. Passport must be valid through your study period.",
      exampleImage: "/examples/passport-example.svg",
    },
    FINANCIAL_PROOF: {
      instructions:
        "Upload a recent official bank statement showing your name, account number, statement date, and closing balance. For UK applications, funds should satisfy the 28-day rule.",
      exampleImage: "/examples/financial-proof-example.svg",
    },
    TRANSCRIPT: {
      instructions:
        "Upload an official transcript with institution name, subject list, grades, and completion details. Avoid cropped pages or low-resolution screenshots.",
      exampleImage: "/examples/document-example.svg",
    },
    DEGREE_CERT: {
      instructions:
        "Upload your degree certificate with your full name, qualification title, awarding institution, and award date clearly visible.",
      exampleImage: "/examples/document-example.svg",
    },
    ENGLISH_TEST: {
      instructions:
        "Upload your official English test result report (IELTS/PTE/TOEFL), including candidate details, score breakdown, and test date.",
      exampleImage: "/examples/document-example.svg",
    },
    SOP: {
      instructions:
        "Upload your latest Statement of Purpose as a PDF or clear image. Ensure your name and intended course are correct.",
      exampleImage: "/examples/document-example.svg",
    },
    LOR: {
      instructions:
        "Upload signed recommendation letter(s) with recommender details and institutional letterhead where applicable.",
      exampleImage: "/examples/document-example.svg",
    },
    CV: {
      instructions:
        "Upload your most recent CV including education, work history, skills, and dates.",
      exampleImage: "/examples/document-example.svg",
    },
    PHOTO: {
      instructions:
        "Upload a recent passport-style photo with plain background and clear facial visibility.",
      exampleImage: "/examples/document-example.svg",
    },
    VISA_DOCUMENT: {
      instructions:
        "Upload the requested visa-related document exactly as instructed by your counsellor (e.g., TB certificate or ATAS letter).",
      exampleImage: "/examples/document-example.svg",
    },
    PERSONAL_STATEMENT: {
      instructions:
        "Upload your latest personal statement with accurate personal details and course intent.",
      exampleImage: "/examples/document-example.svg",
    },
    COVER_LETTER: {
      instructions:
        "Upload your signed cover letter in PDF/image format with date and relevant application references.",
      exampleImage: "/examples/document-example.svg",
    },
    OTHER: {
      instructions:
        "Upload the requested supporting file clearly and completely, including all pages.",
      exampleImage: "/examples/document-example.svg",
    },
  };

  return map[documentType] ?? map.OTHER;
}
