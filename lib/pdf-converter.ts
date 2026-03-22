import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

type CompressionTier = 80 | 70 | 60;

export type PdfProcessResult = {
  file: File;
  converted: boolean;
  compressed: boolean;
};

export class PDFConverter {
  static isImage(file: File) {
    const mimeType = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    return IMAGE_MIME_TYPES.includes(mimeType) || IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
  }

  static isPdf(file: File) {
    return file.type.toLowerCase() === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  static getCompressionTier(sizeInBytes: number): CompressionTier | null {
    if (sizeInBytes <= 5 * 1024 * 1024) return null;
    if (sizeInBytes <= 10 * 1024 * 1024) return 80;
    if (sizeInBytes <= 20 * 1024 * 1024) return 70;
    return 60;
  }

  static async convertImageToPDF(file: File, quality?: CompressionTier): Promise<PdfProcessResult> {
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const prepared = await this.prepareImageForPdf(imageBuffer, file.type, quality);

    const pdfDoc = await PDFDocument.create();
    const embedded = await this.embedImage(pdfDoc, prepared.buffer, prepared.mimeType);
    const page = pdfDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded.image, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const outputName = this.toPdfName(file.name);
    const output = new File([Buffer.from(pdfBytes)], outputName, { type: "application/pdf" });

    return {
      file: output,
      converted: true,
      compressed: Boolean(quality),
    };
  }

  static async mergeImagesToPDF(files: File[], quality?: CompressionTier): Promise<PdfProcessResult> {
    if (!files.length) throw new Error("No image files provided");

    const pdfDoc = await PDFDocument.create();
    let compressed = false;

    for (const file of files) {
      const imageBuffer = Buffer.from(await file.arrayBuffer());
      const prepared = await this.prepareImageForPdf(imageBuffer, file.type, quality);
      if (quality) compressed = true;

      const embedded = await this.embedImage(pdfDoc, prepared.buffer, prepared.mimeType);
      const page = pdfDoc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded.image, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      });
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const outputName = this.toPdfName(files[0].name.replace(/\.[^.]+$/, "")) || "merged-document.pdf";
    const output = new File([Buffer.from(pdfBytes)], outputName, { type: "application/pdf" });

    return {
      file: output,
      converted: true,
      compressed,
    };
  }

  static async compressPDF(file: File, tier: CompressionTier): Promise<PdfProcessResult> {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const saveOptsByTier: Record<CompressionTier, { useObjectStreams: boolean; addDefaultPage: boolean; objectsPerTick: number }> = {
      80: { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 },
      70: { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 100 },
      60: { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 200 },
    };

    const compressedBytes = await pdf.save(saveOptsByTier[tier]);
    const output = new File([Buffer.from(compressedBytes)], this.toPdfName(file.name), { type: "application/pdf" });

    return {
      file: output,
      converted: false,
      compressed: true,
    };
  }

  private static async prepareImageForPdf(buffer: Buffer, mimeType: string, quality?: CompressionTier) {
    const normalizedMime = mimeType.toLowerCase();
    const pipeline = sharp(buffer, { failOnError: false, limitInputPixels: false }).rotate();

    if (!quality) {
      if (normalizedMime === "image/png") {
        const output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        return { buffer: output, mimeType: "image/png" as const };
      }
      const output = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return { buffer: output, mimeType: "image/jpeg" as const };
    }

    const targetQuality = quality;
    if (normalizedMime === "image/png") {
      const output = await pipeline.png({ compressionLevel: 9, quality: targetQuality }).toBuffer();
      return { buffer: output, mimeType: "image/png" as const };
    }

    const output = await pipeline.jpeg({ quality: targetQuality, mozjpeg: true }).toBuffer();
    return { buffer: output, mimeType: "image/jpeg" as const };
  }

  private static async embedImage(pdfDoc: PDFDocument, buffer: Buffer, mimeType: "image/png" | "image/jpeg") {
    if (mimeType === "image/png") {
      const image = await pdfDoc.embedPng(buffer);
      return { image, width: image.width, height: image.height };
    }

    const image = await pdfDoc.embedJpg(buffer);
    return { image, width: image.width, height: image.height };
  }

  private static toPdfName(fileName: string) {
    const withoutExt = fileName.replace(/\.[^.]+$/, "");
    return `${withoutExt || "document"}.pdf`;
  }
}
