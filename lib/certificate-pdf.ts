import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type CertificateChecklistItem = {
  label: string;
  status: string;
  verifiedAt: Date | null;
};

export async function generateVerifiedCertificatePdf(args: {
  reference: string;
  issuedAt: Date;
  studentName: string;
  studentEmail: string;
  nationality: string | null;
  destinationCountry: string | null;
  universityName: string;
  courseName: string;
  counsellorName: string;
  studyGapColour: "GREEN" | "YELLOW" | "RED";
  items: CertificateChecklistItem[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: rgb(0.07, 0.2, 0.4) });
  page.drawText("EduQuantica", {
    x: 32,
    y: height - 56,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Verified Document Certificate", {
    x: 32,
    y: height - 84,
    size: 14,
    font: regular,
    color: rgb(0.88, 0.93, 1),
  });

  page.drawText(`Reference: ${args.reference}`, {
    x: width - 240,
    y: height - 56,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Issued: ${args.issuedAt.toLocaleDateString("en-GB")}`, {
    x: width - 240,
    y: height - 74,
    size: 10,
    font: regular,
    color: rgb(0.88, 0.93, 1),
  });

  let y = height - 142;
  const lines: Array<[string, string]> = [
    ["Student Name", args.studentName],
    ["Student Email", args.studentEmail],
    ["Nationality", args.nationality || "-"],
    ["Destination Country", args.destinationCountry || "-"],
    ["University", args.universityName],
    ["Course", args.courseName],
    ["Assigned Counsellor", args.counsellorName],
  ];

  for (const [label, value] of lines) {
    page.drawText(`${label}:`, { x: 32, y, size: 10, font: bold, color: rgb(0.15, 0.18, 0.22) });
    page.drawText(value, { x: 180, y, size: 10, font: regular, color: rgb(0.25, 0.28, 0.35) });
    y -= 20;
  }

  y -= 8;
  page.drawRectangle({ x: 32, y: y - 2, width: width - 64, height: 20, color: rgb(0.93, 0.95, 0.98) });
  page.drawText("Verified Documents", { x: 36, y: y + 4, size: 10, font: bold, color: rgb(0.13, 0.2, 0.3) });
  y -= 20;

  for (const item of args.items.slice(0, 24)) {
    page.drawText(item.label.slice(0, 42), { x: 36, y, size: 9, font: regular, color: rgb(0.25, 0.28, 0.35) });
    page.drawText(item.status, { x: 380, y, size: 9, font: bold, color: rgb(0.08, 0.46, 0.26) });
    page.drawText(item.verifiedAt ? item.verifiedAt.toLocaleDateString("en-GB") : "-", {
      x: 470,
      y,
      size: 9,
      font: regular,
      color: rgb(0.25, 0.28, 0.35),
    });
    y -= 14;
  }

  page.drawLine({
    start: { x: 32, y: 105 },
    end: { x: width - 32, y: 105 },
    color: rgb(0.85, 0.87, 0.9),
    thickness: 1,
  });

  page.drawText("This certificate confirms that required pre-admission documents were verified by EduQuantica.", {
    x: 32,
    y: 84,
    size: 9,
    font: regular,
    color: rgb(0.4, 0.43, 0.5),
  });

  page.drawText("Authorised by EduQuantica Document Verification Team", {
    x: 32,
    y: 62,
    size: 10,
    font: bold,
    color: rgb(0.13, 0.2, 0.3),
  });

  const indicatorColour =
    args.studyGapColour === "RED"
      ? rgb(0.9, 0.2, 0.2)
      : args.studyGapColour === "YELLOW"
        ? rgb(0.92, 0.65, 0.12)
        : rgb(0.1, 0.65, 0.35);

  page.drawCircle({
    x: width - 110,
    y: 36,
    size: 5,
    color: indicatorColour,
  });

  page.drawText("(Indicator)", {
    x: width - 98,
    y: 32,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.4, 0.48),
  });

  return Buffer.from(await pdf.save());
}

export async function generateStudentDeclarationPdf(args: {
  reference: string;
  issuedAt: Date;
  studentName: string;
  studentEmail: string;
  signatureName: string;
  declarationText: string;
  applicationRef?: string | null;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: rgb(0.08, 0.22, 0.44) });
  page.drawText("EduQuantica Student Declaration", {
    x: 32,
    y: height - 60,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = height - 130;
  page.drawText(`Reference: ${args.reference}`, { x: 32, y, size: 10, font: bold, color: rgb(0.2, 0.24, 0.3) });
  y -= 18;
  page.drawText(`Issued: ${args.issuedAt.toLocaleDateString("en-GB")}`, { x: 32, y, size: 10, font: regular, color: rgb(0.28, 0.32, 0.38) });
  y -= 24;

  page.drawText(`Student: ${args.studentName}`, { x: 32, y, size: 10, font: bold, color: rgb(0.2, 0.24, 0.3) });
  y -= 18;
  page.drawText(`Email: ${args.studentEmail}`, { x: 32, y, size: 10, font: regular, color: rgb(0.28, 0.32, 0.38) });
  if (args.applicationRef) {
    y -= 18;
    page.drawText(`Application: ${args.applicationRef}`, { x: 32, y, size: 10, font: regular, color: rgb(0.28, 0.32, 0.38) });
  }

  y -= 28;
  page.drawText("Declaration", { x: 32, y, size: 12, font: bold, color: rgb(0.16, 0.2, 0.28) });
  y -= 18;

  const maxLineChars = 88;
  const words = args.declarationText.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  for (const line of lines.slice(0, 34)) {
    page.drawText(line, { x: 32, y, size: 10, font: regular, color: rgb(0.28, 0.32, 0.38) });
    y -= 14;
  }

  y = Math.max(y - 12, 84);
  page.drawLine({
    start: { x: 32, y },
    end: { x: width - 32, y },
    color: rgb(0.86, 0.88, 0.92),
    thickness: 1,
  });
  y -= 20;
  page.drawText(`Signed by: ${args.signatureName}`, { x: 32, y, size: 10, font: bold, color: rgb(0.2, 0.24, 0.3) });
  y -= 16;
  page.drawText(`Signed at: ${args.issuedAt.toLocaleString("en-GB")}`, { x: 32, y, size: 10, font: regular, color: rgb(0.28, 0.32, 0.38) });

  return Buffer.from(await pdf.save());
}
