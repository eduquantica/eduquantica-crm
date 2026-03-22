import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PDFConverter } from "@/lib/pdf-converter";
import { getLocalUploadPath, storeUpload } from "@/lib/local-upload";

function buildNotice(converted: boolean, compressed: boolean) {
  if (converted && compressed) return "Image converted to PDF and compressed.";
  if (converted) return "Image automatically converted to PDF.";
  if (compressed) return "PDF automatically compressed for upload.";
  return "";
}

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const mobileSession = await db.mobileUploadSession.findUnique({
      where: { token: params.token },
      select: {
        token: true,
        studentId: true,
        documentField: true,
        documentType: true,
        status: true,
        uploadedFileName: true,
        uploadedFileUrl: true,
        expiresAt: true,
      },
    });

    if (!mobileSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const expired = isExpired(mobileSession.expiresAt) || mobileSession.status === "EXPIRED";
    if (expired && mobileSession.status !== "COMPLETED") {
      if (mobileSession.status !== "EXPIRED") {
        await db.mobileUploadSession.update({
          where: { token: params.token },
          data: { status: "EXPIRED" },
        });
      }

      return NextResponse.json({
        valid: false,
        status: "EXPIRED",
        studentId: mobileSession.studentId,
        documentField: mobileSession.documentField,
        documentType: mobileSession.documentType,
        uploadedFileName: mobileSession.uploadedFileName,
        uploadedFileUrl: mobileSession.uploadedFileUrl,
        expiresAt: mobileSession.expiresAt,
      }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      status: mobileSession.status,
      studentId: mobileSession.studentId,
      documentField: mobileSession.documentField,
      documentType: mobileSession.documentType,
      uploadedFileName: mobileSession.uploadedFileName,
      uploadedFileUrl: mobileSession.uploadedFileUrl,
      expiresAt: mobileSession.expiresAt,
    });
  } catch (error) {
    console.error("[/api/mobile-upload/[token] GET]", error);
    return NextResponse.json({ error: "Failed to load mobile upload session" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const mobileSession = await db.mobileUploadSession.findUnique({
      where: { token: params.token },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!mobileSession) {
      return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
    }

    const expired = isExpired(mobileSession.expiresAt) || mobileSession.status === "EXPIRED";
    if (expired && mobileSession.status !== "COMPLETED") {
      if (mobileSession.status !== "EXPIRED") {
        await db.mobileUploadSession.update({
          where: { id: mobileSession.id },
          data: { status: "EXPIRED" },
        });
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

    await db.mobileUploadSession.update({
      where: { id: mobileSession.id },
      data: {
        status: "COMPLETED",
        uploadedFileUrl: fileUrl,
        uploadedFileName: fileName,
        usedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      fileName,
      fileUrl,
      message: buildNotice(processed.converted, processed.compressed),
    });
  } catch (error) {
    console.error("[/api/mobile-upload/[token] POST]", error);
    return NextResponse.json({ success: false, reason: "internal_error" }, { status: 500 });
  }
}
