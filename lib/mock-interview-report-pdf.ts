import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { UTApi } from "uploadthing/server";

export async function createMockInterviewReportPdf(args: {
  title: string;
  studentName: string;
  nationality: string | null;
  universityName: string;
  courseName: string;
  interviewType: string;
  dateCompleted: Date;
  overallScore: number;
  recommendation: string;
  roundScores: Array<{ roundName: string; score: number | null }>;
  strengths: string[];
  areasToImprove: string[];
  detailedFeedback: string;
  transcript: string;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 44;
  const pageSize: [number, number] = [595, 842];
  const lineHeight = 14;

  let page = pdf.addPage(pageSize);
  let { width, height } = page.getSize();
  let y = height - margin;

  function writeLine(text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
    const size = opts?.size || 11;
    const font = opts?.bold ? bold : regular;
    const color = opts?.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0.1, 0.15, 0.22);

    if (y < margin + lineHeight) {
      page = pdf.addPage(pageSize);
      ({ width, height } = page.getSize());
      y = height - margin;
    }

    page.drawText(text, {
      x: margin,
      y,
      size,
      font,
      color,
      maxWidth: width - margin * 2,
      lineHeight,
    });
    y -= lineHeight + 2;
  }

  function wrap(text: string, maxChars = 95) {
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

  writeLine(args.title, { bold: true, size: 16, color: [0.11, 0.16, 0.29] });
  y -= 4;
  writeLine(`Student: ${args.studentName}${args.nationality ? ` (${args.nationality})` : ""}`);
  writeLine(`University/Course: ${args.universityName} - ${args.courseName}`);
  writeLine(`Interview Type: ${args.interviewType}`);
  writeLine(`Completed: ${args.dateCompleted.toLocaleDateString("en-GB")}`);
  writeLine(`Overall Score: ${args.overallScore.toFixed(2)}%`);
  writeLine(`Result: ${args.recommendation}`, { bold: true });

  y -= 6;
  writeLine("Round Scores", { bold: true, size: 13 });
  for (const row of args.roundScores) {
    writeLine(`- ${row.roundName}: ${typeof row.score === "number" ? `${row.score.toFixed(2)}%` : "N/A"}`);
  }

  y -= 6;
  writeLine("Top 3 Strengths", { bold: true, size: 13 });
  for (const item of args.strengths.slice(0, 3)) {
    for (const line of wrap(`- ${item}`)) writeLine(line);
  }

  y -= 6;
  writeLine("Top 3 Areas to Improve", { bold: true, size: 13 });
  for (const item of args.areasToImprove.slice(0, 3)) {
    for (const line of wrap(`- ${item}`)) writeLine(line);
  }

  y -= 6;
  writeLine("Detailed Feedback", { bold: true, size: 13 });
  for (const line of wrap(args.detailedFeedback, 92)) writeLine(line);

  y -= 6;
  writeLine("Full Transcript", { bold: true, size: 13 });
  const transcriptSanitized = (args.transcript || "").replace(/<[^>]*>/g, " ").replace(/\r/g, "");
  for (const paragraph of transcriptSanitized.split("\n")) {
    for (const line of wrap(paragraph || " ", 92)) writeLine(line, { size: 10 });
    y -= 2;
  }

  return Buffer.from(await pdf.save());
}

export async function uploadMockInterviewReportPdf(fileName: string, bytes: Uint8Array) {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) throw new Error("UPLOADTHING_TOKEN is required to upload mock interview report PDFs");

  const utapi = new UTApi({ token });
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], fileName, { type: "application/pdf" });
  const uploaded = await utapi.uploadFiles(file);

  if (uploaded.error || !uploaded.data?.url) {
    throw new Error(uploaded.error?.message || "Failed to upload mock interview report PDF");
  }

  return uploaded.data.url;
}
