import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PDFConverter } from "@/lib/pdf-converter";
import { getLocalUploadPath, storeUpload } from "@/lib/local-upload";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const preserveOriginal = String(formData.get("preserveOriginal") || "").toLowerCase() === "true";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
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

    const stored = await Promise.all(transformed.map((result) => storeUpload(result.file)));
    const urls = stored.map((row) => new URL(getLocalUploadPath(row.key), request.url).toString());

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
    console.error("[/api/upload POST]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
