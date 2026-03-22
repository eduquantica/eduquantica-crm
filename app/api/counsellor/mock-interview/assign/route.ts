import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockInterviewAccessContextByApplication } from "@/lib/mock-interview-access";
import { extractOfferLetterFacts, fetchAndExtractUrlText, normalizeUrlText } from "@/lib/mock-interview-materials";
import { notifyMockInterviewAssigned } from "@/lib/mock-interview-notifications";

const assignSchema = z.object({
  applicationId: z.string().min(1),
  interviewType: z.enum([
    "PRE_CAS_UNIVERSITY",
    "UK_VISA",
    "US_VISA",
    "CANADA_STUDY_PERMIT",
    "AUSTRALIA_STUDENT_VISA",
    "GENERAL_PREPARATION",
  ]),
  passingScore: z.number().int().min(0).max(100).optional(),
  offerLetterUrl: z.string().url().optional().or(z.literal("")),
  courseUrl: z.string().url().optional().or(z.literal("")),
  universityAboutUrl: z.string().url().optional().or(z.literal("")),
  universityAboutText: z.string().optional(),
  sampleQuestionsUrl: z.string().url().optional().or(z.literal("")),
  sampleQuestionsText: z.string().optional(),
  customQuestions: z.any().optional(),
  customInstructions: z.string().optional(),
  extractedUniversity: z.string().optional(),
  extractedCourse: z.string().optional(),
  extractedDuration: z.string().optional(),
  extractedTuitionFee: z.string().optional(),
  extractedStartDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = assignSchema.parse(await req.json());

    const access = await getMockInterviewAccessContextByApplication(session, payload.applicationId);
    if (!access) return NextResponse.json({ error: "Application not found or access denied" }, { status: 404 });
    if (access.actor.roleName === "STUDENT") {
      return NextResponse.json({ error: "Students cannot assign mock interviews" }, { status: 403 });
    }

    let universityAboutText = normalizeUrlText(payload.universityAboutText);
    let sampleQuestionsText = normalizeUrlText(payload.sampleQuestionsText);

    if (!universityAboutText && payload.universityAboutUrl) {
      universityAboutText = await fetchAndExtractUrlText(payload.universityAboutUrl);
    }

    if (!sampleQuestionsText && payload.sampleQuestionsUrl) {
      sampleQuestionsText = await fetchAndExtractUrlText(payload.sampleQuestionsUrl);
    }

    let extracted = {
      extractedUniversity: payload.extractedUniversity || null,
      extractedCourse: payload.extractedCourse || null,
      extractedDuration: payload.extractedDuration || null,
      extractedTuitionFee: payload.extractedTuitionFee || null,
      extractedStartDate: payload.extractedStartDate || null,
    };

    if ((!extracted.extractedUniversity || !extracted.extractedCourse) && sampleQuestionsText) {
      extracted = { ...extracted, ...extractOfferLetterFacts(sampleQuestionsText) };
    }

    const attempts = await db.mockInterview.count({
      where: {
        applicationId: payload.applicationId,
        interviewType: payload.interviewType,
      },
    });

    const interview = await db.mockInterview.create({
      data: {
        applicationId: payload.applicationId,
        studentId: access.student.id,
        assignedById: access.actor.id,
        interviewType: payload.interviewType,
        status: "ASSIGNED",
        offerLetterUrl: payload.offerLetterUrl || null,
        courseUrl: payload.courseUrl || null,
        universityAboutUrl: payload.universityAboutUrl || null,
        universityAboutText: universityAboutText || null,
        sampleQuestionsUrl: payload.sampleQuestionsUrl || null,
        sampleQuestionsText: sampleQuestionsText || null,
        customQuestions: payload.customQuestions ?? null,
        customInstructions: payload.customInstructions || null,
        passingScore: payload.passingScore ?? 80,
        attemptNumber: attempts + 1,
        extractedUniversity: extracted.extractedUniversity,
        extractedCourse: extracted.extractedCourse,
        extractedDuration: extracted.extractedDuration,
        extractedTuitionFee: extracted.extractedTuitionFee,
        extractedStartDate: extracted.extractedStartDate,
      },
      include: {
        student: { select: { id: true, userId: true, email: true, firstName: true, lastName: true, subAgentId: true, subAgentStaffId: true } },
      },
    });

    await notifyMockInterviewAssigned({
      interviewId: interview.id,
      studentId: interview.student.id,
      studentUserId: interview.student.userId,
      studentEmail: interview.student.email,
      studentName: `${interview.student.firstName} ${interview.student.lastName}`.trim(),
      universityName: access.application.universityName,
      assignedById: access.actor.id,
      assignedByName: session.user.name || session.user.email || "Counsellor",
      subAgentId: interview.student.subAgentId,
      subAgentStaffId: interview.student.subAgentStaffId,
    }).catch(() => undefined);

    return NextResponse.json({
      data: {
        id: interview.id,
        status: interview.status,
        assignedAt: interview.assignedAt,
        attemptNumber: interview.attemptNumber,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/counsellor/mock-interview/assign POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
