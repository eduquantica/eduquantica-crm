import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateVerifiedCertificatePdf } from "@/lib/certificate-pdf";
import { sendMail } from "@/lib/email";
import { StudyGapCalculator } from "@/lib/study-gap";
import { randomUUID } from "crypto";

const ALLOWED_ROLES = new Set(["ADMIN", "COUNSELLOR"]);

async function buildNextVerificationRef() {
  const year = new Date().getUTCFullYear();
  const prefix = `EQ-VER-${year}-`;

  const existing = await db.documentChecklist.findMany({
    where: { verificationRef: { startsWith: prefix } },
    select: { verificationRef: true },
    orderBy: { verificationRef: "desc" },
    take: 1,
  });

  const last = existing[0]?.verificationRef;
  const currentNumber = last ? Number(last.split("-").pop() || "0") : 0;
  const nextNumber = currentNumber + 1;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checklist = await db.documentChecklist.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            assignedCounsellor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        application: {
          include: {
            course: {
              include: {
                university: true,
              },
            },
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            label: true,
            status: true,
            isRequired: true,
            documentId: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      checklist.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requiredItems = checklist.items.filter((item) => item.isRequired);
    const allRequiredVerified =
      requiredItems.length > 0 &&
      requiredItems.every((item) => item.status === "VERIFIED" && Boolean(item.documentId));

    if (!allRequiredVerified) {
      return NextResponse.json({ error: "All required checklist items must be verified first" }, { status: 400 });
    }

    const verificationRef = checklist.verificationRef || (await buildNextVerificationRef());
    const certificateUrl = `/api/admin/checklists/${checklist.id}/certificate-file`;
    const publicToken = randomUUID();

    const studentName = `${checklist.student.firstName} ${checklist.student.lastName}`.trim();
    const counsellorName =
      checklist.student.assignedCounsellor?.name || checklist.student.assignedCounsellor?.email || "Unassigned";
    const studyGapIndicator = await StudyGapCalculator.calculateGap(checklist.student.id);

    await generateVerifiedCertificatePdf({
      reference: verificationRef,
      issuedAt: new Date(),
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

    await db.$transaction(async (tx) => {
      await tx.documentChecklist.update({
        where: { id: checklist.id },
        data: {
          status: "VERIFIED",
          verifiedBy: session.user.id,
          verifiedAt: new Date(),
          verificationRef,
          signedPdfUrl: certificateUrl,
        },
      });

      await tx.notification.create({
        data: {
          userId: checklist.student.userId,
          type: "CHECKLIST_CERTIFICATE_READY",
          message: `Your EduQuantica Verified Certificate is now available (${verificationRef}).`,
          linkUrl: "/student/documents",
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "checklist",
          entityId: checklist.id,
          action: "checklist_certificate_generated",
          details: `Certificate ${verificationRef} generated for ${studentName}`,
        },
      });

      await tx.verifiedCertificate.upsert({
        where: { checklistId: checklist.id },
        update: {
          reference: verificationRef,
          studentName,
          studentEmail: checklist.student.email,
          universityName: checklist.application?.course.university.name || "-",
          courseName: checklist.application?.course.name || "-",
          destinationCountry: checklist.destinationCountry,
          issuedAt: new Date(),
          pdfUrl: certificateUrl,
        },
        create: {
          checklistId: checklist.id,
          reference: verificationRef,
          publicToken,
          studentName,
          studentEmail: checklist.student.email,
          universityName: checklist.application?.course.university.name || "-",
          courseName: checklist.application?.course.name || "-",
          destinationCountry: checklist.destinationCountry,
          issuedAt: new Date(),
          pdfUrl: certificateUrl,
        },
      });
    });

    const record = await db.verifiedCertificate.findUnique({
      where: { checklistId: checklist.id },
      select: { publicToken: true },
    });
    const verificationUrl = record?.publicToken ? `/verify/certificate/${record.publicToken}` : null;

    await sendMail({
      to: checklist.student.email,
      subject: "Your EduQuantica verified certificate is ready",
      text: `Hello ${studentName},\n\nYour verified document certificate is now available. Reference: ${verificationRef}.\n\nOpen your checklist portal to download it.`,
      html: `<p>Hello ${studentName},</p><p>Your verified document certificate is now available.</p><p><strong>Reference:</strong> ${verificationRef}</p><p>Please open your checklist portal to download it.</p>`,
    });

    return NextResponse.json({
      data: {
        checklistId: checklist.id,
        verificationRef,
        signedPdfUrl: certificateUrl,
        verificationUrl,
      },
    });
  } catch (error) {
    console.error("[/api/admin/checklists/[id]/generate-certificate POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
