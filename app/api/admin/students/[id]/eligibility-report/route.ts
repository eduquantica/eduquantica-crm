import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function canAccessEligibilityTools(roleName?: string): boolean {
  return roleName === "COUNSELLOR" || roleName === "ADMIN" || roleName === "MANAGER";
}

function wrapText(text: string, maxChars = 95): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function fmtScore(value: number | null | undefined): string {
  if (value == null) return "-";
  return Number(value).toFixed(1);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canAccessEligibilityTools(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationality: true,
      assignedCounsellorId: true,
      academicProfile: {
        select: {
          qualifications: {
            include: {
              subjects: {
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courseId = req.nextUrl.searchParams.get("courseId");

  const matches = await db.courseEligibilityResult.findMany({
    where: {
      studentId: student.id,
      ...(courseId ? { courseId } : {}),
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          level: true,
          university: {
            select: {
              name: true,
              country: true,
            },
          },
        },
      },
    },
    orderBy: [
      { matchScore: "desc" },
      { calculatedAt: "desc" },
    ],
  });

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageHeight = 842;

  let y = pageHeight - 44;

  const newPage = () => {
    page = pdfDoc.addPage([595, 842]);
    y = pageHeight - 44;
  };

  const drawLine = (text: string, size = 10, isBold = false) => {
    if (y < 40) {
      newPage();
    }

    page.drawText(text, {
      x: 40,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= size + 6;
  };

  drawLine("Eduquantica - Eligibility Review Report", 16, true);
  drawLine(`Generated: ${new Date().toLocaleString("en-GB")}`, 9);
  y -= 4;

  drawLine("Student", 12, true);
  drawLine(`Name: ${student.firstName} ${student.lastName}`);
  drawLine(`Student ID: ${student.id}`);
  drawLine(`Nationality: ${student.nationality || "-"}`);
  y -= 2;

  drawLine("Academic Profile", 12, true);
  const qualifications = student.academicProfile?.qualifications ?? [];
  if (qualifications.length === 0) {
    drawLine("No qualifications found.");
  } else {
    for (const qualification of qualifications) {
      drawLine(`• ${qualification.qualName} (${qualification.qualType})`, 10, true);
      drawLine(`  Institution: ${qualification.institutionName || "-"} | Year: ${qualification.yearCompleted || "-"}`);
      drawLine(`  Overall Grade: ${qualification.overallGrade || "-"} | Universal: ${fmtScore(qualification.overallUniversal)}`);

      const topSubjects = qualification.subjects.slice(0, 6);
      if (topSubjects.length) {
        for (const subject of topSubjects) {
          drawLine(`  - ${subject.subjectName}: ${subject.rawGrade || "-"} (Universal ${fmtScore(subject.universalScore)})`, 9);
        }
      }
      y -= 2;
    }
  }

  drawLine("Course Matches", 12, true);
  if (!matches.length) {
    drawLine("No eligibility matches available.");
  } else {
    for (const match of matches) {
      drawLine(
        `• ${match.course.name} | ${match.course.university.name} (${match.course.university.country})`,
        10,
        true,
      );
      drawLine(`  Status: ${match.matchStatus} | Score: ${fmtScore(match.matchScore)} | Overall: ${match.overallMet ? "Met" : "Not met"}`);
      if (match.englishMet !== null) {
        drawLine(`  English: ${match.englishMet ? "Met" : "Not met"}`, 9);
      }

      if (match.missingSubjects.length) {
        const lines = wrapText(`Missing subjects: ${match.missingSubjects.join(", ")}`);
        for (const line of lines) drawLine(`  ${line}`, 9);
      }

      if (match.weakSubjects.length) {
        const lines = wrapText(`Weak subjects: ${match.weakSubjects.join(", ")}`);
        for (const line of lines) drawLine(`  ${line}`, 9);
      }

      if (match.counsellorFlagNote) {
        const lines = wrapText(`Counsellor note: ${match.counsellorFlagNote}`);
        for (const line of lines) drawLine(`  ${line}`, 9);
      }

      y -= 2;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const safeName = `${student.firstName}-${student.lastName}`.replace(/\s+/g, "-").toLowerCase();

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="eligibility-report-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
