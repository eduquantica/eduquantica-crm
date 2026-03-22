import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateVerifiedCertificatePdf } from "@/lib/certificate-pdf";
import { StudyGapCalculator } from "@/lib/study-gap";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checklist = await db.documentChecklist.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            assignedCounsellor: { select: { id: true, name: true, email: true } },
          },
        },
        application: {
          include: {
            course: { include: { university: true } },
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            label: true,
            status: true,
            verifiedAt: true,
            isRequired: true,
            documentId: true,
          },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    const role = session.user.roleName;
    if (role === "STUDENT") {
      const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
      if (!student || student.id !== checklist.studentId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (role === "SUB_AGENT") {
      const subAgent = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } });
      if (!subAgent || checklist.student.subAgentId !== subAgent.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (role === "COUNSELLOR" && checklist.student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requiredItems = checklist.items.filter((item) => item.isRequired);
    const allRequiredVerified =
      requiredItems.length > 0 &&
      requiredItems.every((item) => item.status === "VERIFIED" && Boolean(item.documentId));

    if (!allRequiredVerified) {
      return NextResponse.json({ error: "Checklist is not fully verified" }, { status: 400 });
    }

    const studentName = `${checklist.student.firstName} ${checklist.student.lastName}`.trim();
    const counsellorName =
      checklist.student.assignedCounsellor?.name || checklist.student.assignedCounsellor?.email || "Unassigned";
    const studyGapIndicator = await StudyGapCalculator.calculateGap(checklist.student.id);

    const pdf = await generateVerifiedCertificatePdf({
      reference: checklist.verificationRef || "PENDING-REFERENCE",
      issuedAt: checklist.verifiedAt || new Date(),
      studentName,
      studentEmail: checklist.student.email,
      nationality: checklist.student.nationality,
      destinationCountry: checklist.destinationCountry,
      universityName: checklist.application?.course.university.name || "-",
      courseName: checklist.application?.course.name || "-",
      counsellorName,
      studyGapColour: studyGapIndicator.colour,
      items: checklist.items.map((item) => ({
        label: item.label,
        status: item.status,
        verifiedAt: item.verifiedAt,
      })),
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="eduquantica-verified-certificate-${checklist.verificationRef || checklist.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[/api/admin/checklists/[id]/certificate-file GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
