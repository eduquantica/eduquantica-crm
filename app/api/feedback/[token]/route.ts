import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyLinkedSubAgent } from "@/lib/post-enrolment";

const schema = z.object({
  overallSatisfaction: z.number().int().min(1).max(5),
  counsellorHelpfulness: z.number().int().min(1).max(5),
  applicationProcessRating: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean(),
  comments: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const service = await db.postEnrolmentService.findUnique({
    where: { feedbackToken: params.token },
    include: {
      student: true,
      application: {
        include: {
          university: true,
          course: true,
        },
      },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Invalid feedback link" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      studentName: `${service.student.firstName} ${service.student.lastName}`,
      university: service.application.university.name,
      course: service.application.course.name,
      alreadySubmitted: service.feedbackStatus === "RECEIVED",
      feedback: service.feedbackStatus === "RECEIVED"
        ? {
            overallSatisfaction: service.feedbackOverallSatisfaction,
            counsellorHelpfulness: service.feedbackCounsellorHelpfulness,
            applicationProcessRating: service.feedbackApplicationProcess,
            wouldRecommend: service.feedbackWouldRecommend,
            comments: service.feedbackComments,
          }
        : null,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const service = await db.postEnrolmentService.findUnique({
      where: { feedbackToken: params.token },
      include: {
        student: true,
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Invalid feedback link" }, { status: 404 });
    }

    const payload = schema.parse(await req.json());

    const updated = await db.postEnrolmentService.update({
      where: { id: service.id },
      data: {
        feedbackStatus: "RECEIVED",
        feedbackSubmittedAt: new Date(),
        feedbackOverallSatisfaction: payload.overallSatisfaction,
        feedbackCounsellorHelpfulness: payload.counsellorHelpfulness,
        feedbackApplicationProcess: payload.applicationProcessRating,
        feedbackWouldRecommend: payload.wouldRecommend,
        feedbackComments: payload.comments || null,
      },
    });

    await notifyLinkedSubAgent(
      service.studentId,
      `Feedback has been received for ${service.student.firstName} ${service.student.lastName}.`,
    );

    return NextResponse.json({ data: { id: updated.id } });
  } catch (error) {
    console.error("Error saving feedback", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
