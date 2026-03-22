import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { UTApi } from "uploadthing/server";

function wrapText(text: string, maxChars = 95): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function createWrittenDocumentPdf(args: {
  title: string;
  typeLabel: string;
  studentName: string;
  content: string;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]);
  let { width, height } = page.getSize();

  const margin = 48;
  const maxY = height - margin;
  const minY = margin;
  const lineHeight = 18;

  let y = maxY;

  page.drawText("EduQuantica Written Document", {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: rgb(0.11, 0.16, 0.29),
  });

  y -= 28;
  page.drawText(`Title: ${args.title}`, { x: margin, y, size: 12, font: bold });
  y -= 18;
  page.drawText(`Type: ${args.typeLabel}`, { x: margin, y, size: 11, font: regular });
  y -= 16;
  page.drawText(`Student: ${args.studentName}`, { x: margin, y, size: 11, font: regular });
  y -= 24;

  const content = (args.content || "").replace(/<[^>]*>/g, " ").replace(/\r/g, "");
  const paragraphs = content.split("\n");

  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph || " ");
    for (const line of lines) {
      if (y <= minY) {
        page = pdf.addPage([595, 842]);
        ({ width, height } = page.getSize());
        y = height - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 11,
        font: regular,
        maxWidth: width - margin * 2,
      });
      y -= lineHeight;
    }
    y -= 6;
  }

  return Buffer.from(await pdf.save());
}

export async function uploadWrittenDocumentPdf(fileName: string, bytes: Uint8Array) {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) {
    throw new Error("UPLOADTHING_TOKEN is required to upload written document PDFs");
  }

  const utapi = new UTApi({ token });
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], fileName, { type: "application/pdf" });
  const uploaded = await utapi.uploadFiles(file);

  if (uploaded.error || !uploaded.data?.url) {
    throw new Error(uploaded.error?.message || "Failed to upload written document PDF");
  }

  return uploaded.data.url;
}
