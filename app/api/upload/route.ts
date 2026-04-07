import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { PDFConverter } from "@/lib/pdf-converter";
import { storeUpload, getLocalUploadPath } from "@/lib/local-upload";

export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".doc", ".docx"]);

function isAllowedFile(file: File) {
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  return ALLOWED_EXTENSIONS.has(ext);
}

function buildBlobName(file: File) {
  const name = String(file.name || "upload");
  const sanitized = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "upload";
  return `${Date.now()}-${randomUUID()}-${sanitized}`;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is missing. Add it in project environment variables." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const preserveOriginal = String(formData.get("preserveOriginal") || "").toLowerCase() === "true";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const tooLarge = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (tooLarge) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const invalidType = files.find((file) => !isAllowedFile(file));
    if (invalidType) {
      return NextResponse.json({ error: "Unsupported file type. Allowed: PDF, JPG, JPEG, PNG, WEBP, HEIC, DOC, DOCX" }, { status: 400 });
    }

    const transformed = await Promise.all(
      files.map(async (file) => {
        if (preserveOriginal) {
          return {
            file,
            converted: false,
            compressed: false,
          };
        }

        if (PDFConverter.isImage(file)) {
          const tier = PDFConverter.getCompressionTier(file.size);
          return PDFConverter.convertImageToPDF(file, tier || undefined);
        }

        if (PDFConverter.isPdf(file)) {
          const tier = PDFConverter.getCompressionTier(file.size);
          if (tier) {
            return PDFConverter.compressPDF(file, tier);
          }
          return {
            file,
            converted: false,
            compressed: false,
          };
        }

        return {
          file,
          converted: false,
          compressed: false,
        };
      }),
    );

    console.log("Attempting blob upload", {
      blobTokenExists: !!process.env.BLOB_READ_WRITE_TOKEN,
      fileCount: transformed.length,
      fileTypes: transformed.map(f => f.file.type),
    });

    const stored: Array<{ url: string }> = [];
    for (const result of transformed) {
      try {
        const blob = await put(buildBlobName(result.file), result.file, {
          access: "public",
          contentType: result.file.type || undefined,
        });
        stored.push(blob);
      } catch (blobError) {
        console.warn("Blob upload failed, attempting fallback to local storage", {
          error: blobError instanceof Error ? blobError.message : String(blobError),
          fileName: result.file.name,
        });
        try {
          const localStored = await storeUpload(result.file);
          const localUrl = new URL(getLocalUploadPath(localStored.key), request.url).toString();
          stored.push({ url: localUrl });
          console.log("Fallback local storage succeeded", { fileName: result.file.name });
        } catch (localError) {
          console.error("Fallback local storage also failed", {
            error: localError instanceof Error ? localError.message : String(localError),
            fileName: result.file.name,
          });
          throw localError;
        }
      }
    }
    const urls = stored.map((row) => row.url);

    const notices = transformed.map((result) => {
      if (result.converted && result.compressed) return "Image converted to PDF and compressed.";
      if (result.converted) return "Image automatically converted to PDF.";
      if (result.compressed) return "PDF automatically compressed for upload.";
      return null;
    }).filter((value) => Boolean(value)) as string[];

    const uniqueNotices = Array.from(new Set(notices));
    const message = uniqueNotices.join(" ");

    return NextResponse.json({ urls, notices: uniqueNotices, message }, { status: 200 });
  } catch (e) {
    console.error("Upload error details:", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      blobTokenExists: !!process.env.BLOB_READ_WRITE_TOKEN,
      blobTokenLength: process.env.BLOB_READ_WRITE_TOKEN?.length,
    });
    return NextResponse.json(
      {
        error: "Upload failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
