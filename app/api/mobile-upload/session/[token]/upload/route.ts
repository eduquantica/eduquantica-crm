import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DocumentType } from "@prisma/client";
import { PDFConverter } from "@/lib/pdf-converter";
import { runDocumentScan } from "@/lib/document-scan-service";
import { getLocalUploadPath, storeUpload } from "@/lib/local-upload";

function buildNotice(converted: boolean, compressed: boolean) {
  if (converted && compressed) return "Image converted to PDF and compressed.";
  if (converted) return "Image automatically converted to PDF.";
  if (compressed) return "PDF automatically compressed for upload.";
  return "";
}

function mapSmartDocumentType(documentField: string): DocumentType {
  const value = documentField.toUpperCase();
  if (value.includes("PASSPORT")) return DocumentType.PASSPORT;
  if (value.includes("TRANSCRIPT")) return DocumentType.TRANSCRIPT;
  if (value.includes("CERTIFICATE") || value.includes("DEGREE")) return DocumentType.DEGREE_CERT;
  if (value.includes("TEST") || value.includes("IELTS") || value.includes("TOEFL") || value.includes("PTE") || value.includes("DUOLINGO") || value.includes("OET")) {
    return DocumentType.ENGLISH_TEST;
  }
  if (value.includes("SOP") || value.includes("PERSONAL_STATEMENT")) return DocumentType.SOP;
  if (value.includes("CV") || value.includes("RESUME")) return DocumentType.CV;
  if (value.includes("BANK") || value.includes("FINANCIAL") || value.includes("FUNDS") || value.includes("AFFIDAVIT")) {
    return DocumentType.FINANCIAL_PROOF;
  }
  if (value.includes("VISA") || value.includes("TB") || value.includes("OSHC")) return DocumentType.VISA_DOCUMENT;
  if (value.includes("REFERENCE") || value.includes("LOR")) return DocumentType.LOR;
  return DocumentType.OTHER;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const mobileSession = await db.mobileUploadSession.findUnique({
      where: { token: params.token },
      include: {
        checklistItem: {
          select: {
            id: true,
            documentType: true,
            checklist: { select: { studentId: true } },
          },
        },
      },
    });

    if (!mobileSession) {
      return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
    }

    const checklistItemId = mobileSession.checklistItemId;
    const checklistDocumentType = mobileSession.checklistItem?.documentType || null;

    const expired = mobileSession.expiresAt.getTime() <= Date.now() || mobileSession.status === "EXPIRED";
    if (expired) {
      if (mobileSession.status !== "EXPIRED") {
        await db.mobileUploadSession.update({ where: { id: mobileSession.id }, data: { status: "EXPIRED" } });
      }
      return NextResponse.json({ success: false, reason: "expired" }, { status: 410 });
    }

    if (mobileSession.status === "COMPLETED") {
      return NextResponse.json({ success: false, reason: "already_used" }, { status: 409 });
    }

    const formData = await req.formData();
    const file = (formData.get("file") || formData.getAll("files")[0]) as File | null;
    if (!file) {
      return NextResponse.json({ success: false, reason: "missing_file" }, { status: 400 });
    }

    await db.mobileUploadSession.update({
      where: { id: mobileSession.id },
      data: { status: "UPLOADING" },
    });

    const processed = await (async () => {
      if (PDFConverter.isImage(file)) {
        const tier = PDFConverter.getCompressionTier(file.size);
        return PDFConverter.convertImageToPDF(file, tier || undefined);
      }

      if (PDFConverter.isPdf(file)) {
        const tier = PDFConverter.getCompressionTier(file.size);
        if (tier) return PDFConverter.compressPDF(file, tier);
      }

      return {
        file,
        converted: false,
        compressed: false,
      };
    })();

    const stored = await storeUpload(processed.file);
    const fileUrl = new URL(getLocalUploadPath(stored.key), req.url).toString();
    const fileName = stored.fileName;
    const notice = buildNotice(processed.converted, processed.compressed);

    await db.$transaction(async (tx) => {
      const resolvedType = checklistDocumentType || mapSmartDocumentType(mobileSession.documentField || mobileSession.documentType || "");
      const createdDocument = await tx.document.create({
        data: {
          studentId: mobileSession.studentId,
          type: resolvedType,
          fileName,
          fileUrl,
          status: "PENDING",
        },
        select: { id: true },
      });

      if (checklistItemId) {
        await tx.checklistItem.update({
          where: { id: checklistItemId },
          data: {
            documentId: createdDocument.id,
            status: "UPLOADED",
            ocrStatus: "PENDING",
            fraudRiskLevel: "UNKNOWN",
            fraudFlags: [],
            ocrConfidence: null,
          },
        });
      }

      await tx.mobileUploadSession.update({
        where: { id: mobileSession.id },
        data: {
          status: "COMPLETED",
          uploadedFileUrl: fileUrl,
          uploadedFileName: fileName,
          completedAt: new Date(),
        },
      });
    });

    if (checklistItemId) {
      void runDocumentScan(checklistItemId).catch((error) => {
        console.error(`runDocumentScan failed for checklist item ${checklistItemId}`, error);
      });
    }

    return NextResponse.json({
      success: true,
      fileName,
      fileUrl,
      message: notice,
    });
  } catch (error) {
    console.error("[/api/mobile-upload/session/[token]/upload POST]", error);
    return NextResponse.json({ success: false, reason: "internal_error" }, { status: 500 });
  }
}
