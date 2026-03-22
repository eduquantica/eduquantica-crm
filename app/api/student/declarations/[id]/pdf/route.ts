import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStudentDeclarationPdf } from "@/lib/certificate-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const declaration = await db.studentDeclaration.findUnique({
      where: { id: params.id },
      include: {
        application: {
          select: {
            id: true,
            course: { select: { name: true, university: { select: { name: true } } } },
          },
        },
        student: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!declaration || declaration.studentId !== student.id) {
      return NextResponse.json({ error: "Declaration not found" }, { status: 404 });
    }

    const pdf = await generateStudentDeclarationPdf({
      reference: `EQ-DEC-${declaration.id.slice(0, 8).toUpperCase()}`,
      issuedAt: declaration.signedAt,
      studentName: `${declaration.student.firstName} ${declaration.student.lastName}`.trim(),
      studentEmail: declaration.student.email,
      signatureName: declaration.signatureName,
      declarationText: declaration.declarationText,
      applicationRef: declaration.application
        ? `${declaration.application.course.university.name} - ${declaration.application.course.name}`
        : null,
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="student-declaration-${declaration.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[/api/student/declarations/[id]/pdf GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
