import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveChecklistUiStatus } from "@/lib/checklist-portal";
import { StudyGapCalculator } from "@/lib/study-gap";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || ![
    "SUB_AGENT",
    "ADMIN",
    "MANAGER",
    "COUNSELLOR",
    "BRANCH_MANAGER",
    "SUB_AGENT_COUNSELLOR",
  ].includes(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [subAgent, branchStaff] = await Promise.all([
    db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    db.subAgentStaff.findUnique({ where: { userId: session.user.id }, select: { subAgentId: true } }),
  ]);

  const scopedSubAgentId = subAgent?.id || branchStaff?.subAgentId;
  if (!scopedSubAgentId) return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });

  const student = await db.student.findFirst({
    where: {
      id: params.id,
      subAgentId: scopedSubAgentId,
    },
    include: {
      assignedCounsellor: { select: { id: true, name: true, email: true } },
      applications: {
        orderBy: { createdAt: "desc" },
        include: {
          university: { select: { name: true } },
          course: { select: { name: true, tuitionFee: true, currency: true } },
        },
      },
      mockInterviews: {
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          completedAt: true,
          overallScore: true,
          passingScore: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          fileUrl: true,
          status: true,
          uploadedAt: true,
          scanResult: {
            select: {
              status: true,
              counsellorDecision: true,
              counsellorNote: true,
            },
          },
        },
      },
      documentChecklists: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          signedPdfUrl: true,
          verificationRef: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              label: true,
              documentType: true,
              isRequired: true,
              status: true,
              counsellorNote: true,
              ocrStatus: true,
              ocrData: true,
              ocrConfidence: true,
              document: {
                select: {
                  id: true,
                  fileName: true,
                  fileUrl: true,
                  scanResult: {
                    select: {
                      status: true,
                      counsellorDecision: true,
                      counsellorNote: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
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

  const checklistTypes = [
    "PASSPORT",
    "TRANSCRIPT",
    "DEGREE_CERT",
    "ENGLISH_TEST",
    "SOP",
    "LOR",
    "CV",
    "FINANCIAL_PROOF",
  ];

  const latestChecklist = student.documentChecklists[0];
  const studyGapIndicator = await StudyGapCalculator.calculateGap(student.id).catch(() => ({
    colour: "GREEN" as const,
    gapYears: 0,
    lastQualification: "Unknown",
  }));
  const checklistItems = latestChecklist?.items?.length
    ? latestChecklist.items.map((item) => {
        const ui = resolveChecklistUiStatus(item);
        return {
          id: item.id,
          label: item.label,
          documentType: item.documentType,
          status: ui.status,
          reason: ui.reason,
          ocrStatus: item.ocrStatus,
          documentId: item.document?.id || null,
          fileName: item.document?.fileName || null,
          fileUrl: item.document?.fileUrl || null,
        };
      })
    : checklistTypes.map((type) => {
        const existing = student.documents.find((d) => d.type === type);
        return {
          id: `${student.id}-${type}`,
          label: type.replace(/_/g, " "),
          documentType: type,
          status: existing ? "PENDING" : "PENDING",
          reason: null,
          ocrStatus: existing?.scanResult?.status || null,
          documentId: existing?.id || null,
          fileName: existing?.fileName || null,
          fileUrl: existing?.fileUrl || null,
        };
      });

  const checklist = checklistItems.map((item) => ({
    label: item.label,
    done: item.status === "VERIFIED",
  }));

  const requiredItems = latestChecklist?.items?.filter((item) => item.isRequired) || [];
  const allVerified =
    requiredItems.length > 0 &&
    requiredItems.every((item) => resolveChecklistUiStatus(item).status === "VERIFIED");

  return NextResponse.json({
    data: {
      student: {
        id: student.id,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        profileCompletion: Math.round(
          (
            [
              student.firstName,
              student.lastName,
              student.email,
              student.phone,
              student.dateOfBirth,
              student.nationality,
              student.country,
              student.passportNumber,
              student.passportExpiry,
              student.highestQualification,
            ].filter(Boolean).length / 10
          ) * 100,
        ),
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        nationality: student.nationality,
        country: student.country,
        countryOfResidence: student.country,
        dateOfBirth: student.dateOfBirth,
        passportNumber: student.passportNumber,
        passportExpiry: student.passportExpiry,
        highestQualification: student.highestQualification,
        preferredLevel: null,
        preferredDestination: null,
        preferredFieldOfStudy: null,
        yearCompleted: null,
        institutionName: null,
        notes: null,
        assignedCounsellor: student.assignedCounsellor,
        studyGapIndicator,
        latestMockInterviewResult:
          student.mockInterviews[0]?.completedAt && typeof student.mockInterviews[0].overallScore === "number"
            ? (student.mockInterviews[0].overallScore >= student.mockInterviews[0].passingScore ? "PASS" : "FAIL")
            : null,
      },
      applications: student.applications.map((a) => ({
        id: a.id,
        status: a.status,
        createdAt: a.createdAt,
        university: a.university.name,
        course: a.course.name,
        intake: "-",
        submittedDate: (a.submittedAt || a.createdAt).toISOString(),
        tuitionFee: a.course.tuitionFee,
        currency: a.course.currency,
      })),
      documents: student.documents,
      checklistItems,
      checklist,
      qualifications: student.academicProfile?.qualifications || [],
      certificate: {
        signedPdfUrl: latestChecklist?.signedPdfUrl || null,
        verificationRef: latestChecklist?.verificationRef || null,
        allVerified,
      },
    },
  });
}
