import { NextRequest, NextResponse } from "next/server";
import { ChatSessionType, ChatStatus, LeadSource, LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getNextCounsellor } from "@/lib/counsellor";
import { NotificationService } from "@/lib/notifications";
import { sendMail } from "@/lib/email";

function splitName(name: string) {
  const cleaned = name.trim().replace(/\s+/g, " ");
  const [firstName, ...rest] = cleaned.split(" ");
  return {
    firstName: firstName || "Prospect",
    lastName: rest.join(" ") || "Lead",
  };
}

function calculateChatbotLeadScore(input: {
  name?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  studyInterest?: string;
  country?: string;
  requestedCounsellor?: boolean;
}) {
  let score = 0;
  if (input.name) score += 10;
  if (input.email) score += 20;
  if (input.phone) score += 20;
  if (input.nationality) score += 10;
  if (input.studyInterest) score += 15;
  if (input.country) score += 15;
  if (input.requestedCounsellor) score += 10;
  return Math.min(100, score);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      name?: string;
      email?: string;
      phone?: string;
      nationality?: string;
      studyInterest?: string;
      country?: string;
      requestedCounsellor?: boolean;
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const required = ["name", "email", "phone", "nationality", "studyInterest", "country"] as const;
    const missing = required.filter((field) => !body[field]?.trim());
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const session = await db.chatSession.findUnique({
      where: { id: body.sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    if (session.sessionType !== ChatSessionType.PUBLIC_VISITOR) {
      return NextResponse.json({ error: "Lead capture is only for public visitor sessions" }, { status: 400 });
    }

    if (session.leadCaptured && session.leadId) {
      return NextResponse.json({ data: { leadId: session.leadId, alreadyCaptured: true } });
    }

    const duplicate = await db.lead.findFirst({
      where: {
        email: body.email!.trim().toLowerCase(),
      },
      select: { id: true },
    });

    if (duplicate) {
      await db.chatSession.update({
        where: { id: session.id },
        data: {
          leadCaptured: true,
          leadId: duplicate.id,
          status: ChatStatus.LEAD_CAPTURED,
        },
      });

      return NextResponse.json({
        data: {
          leadId: duplicate.id,
          alreadyCaptured: true,
        },
      });
    }

    const assignment = await getNextCounsellor();
    const parsedName = splitName(body.name!);
    const score = calculateChatbotLeadScore({
      name: body.name,
      email: body.email,
      phone: body.phone,
      nationality: body.nationality,
      studyInterest: body.studyInterest,
      country: body.country,
      requestedCounsellor: body.requestedCounsellor,
    });

    const shortTranscript = session.messages.slice(-30).map((message) => ({
      role: message.role,
      content: message.content,
      at: message.createdAt.toISOString(),
    }));

    const lead = await db.lead.create({
      data: {
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: body.email!.trim().toLowerCase(),
        phone: body.phone!.trim(),
        nationality: body.nationality!.trim(),
        interestedCountry: body.country!.trim(),
        interestedLevel: body.studyInterest!.trim(),
        source: LeadSource.CHATBOT,
        status: LeadStatus.NEW,
        assignedCounsellorId: assignment?.id || null,
        notes: `Auto-captured via Eduvi chatbot on ${new Date().toISOString()}.`,
        chatTranscript: shortTranscript,
        campaign: "Eduvi Chatbot",
        score,
      },
      select: {
        id: true,
        assignedCounsellorId: true,
      },
    });

    await db.chatSession.update({
      where: { id: session.id },
      data: {
        leadCaptured: true,
        leadId: lead.id,
        status: ChatStatus.LEAD_CAPTURED,
      },
    });

    if (assignment?.id) {
      await NotificationService.createNotification({
        userId: assignment.id,
        type: "CHATBOT_LEAD_CAPTURED",
        message: `New lead captured via Eduvi chatbot: ${body.name} interested in ${body.studyInterest} (${body.country}).`,
        linkUrl: `/dashboard/leads`,
      }).catch(() => undefined);

      if (assignment.email) {
        await sendMail({
          to: assignment.email,
          subject: "New Eduvi chatbot lead captured",
          text: `New lead: ${body.name}\nEmail: ${body.email}\nPhone: ${body.phone}\nInterest: ${body.studyInterest}\nCountry: ${body.country}`,
          html: `<p>New lead captured via Eduvi chatbot.</p><ul><li><strong>Name:</strong> ${body.name}</li><li><strong>Email:</strong> ${body.email}</li><li><strong>Phone:</strong> ${body.phone}</li><li><strong>Interest:</strong> ${body.studyInterest}</li><li><strong>Country:</strong> ${body.country}</li></ul>`,
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({
      data: {
        leadId: lead.id,
        assignedCounsellorId: lead.assignedCounsellorId,
        score,
      },
    });
  } catch (error) {
    console.error("[/api/chat/lead-capture POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
