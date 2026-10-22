import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";
import {
  MAX_SOURCE_COUNTRIES,
  getMissingFields,
  isRegistrationEditable,
  registrationDraftSchema,
  registrationToForm,
} from "@/lib/agent-business-registration";

// The sub-agent's own business registration. Only the SUB_AGENT account owner fills it in.
async function loadOwnAgent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  if (session.user.roleName !== "SUB_AGENT") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  const agent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      agencyName: true,
      approvalStatus: true,
      rejectionReason: true,
      businessRegistration: true,
      infoRequests: {
        where: { agentResponse: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { adminMessage: true, createdAt: true },
      },
    },
  });
  if (!agent) return { error: NextResponse.json({ error: "Sub-agent profile not found" }, { status: 404 }) };
  return { session, agent };
}

export async function GET() {
  const loaded = await loadOwnAgent();
  if ("error" in loaded) return loaded.error;
  const { agent } = loaded;
  const submittedAt = agent.businessRegistration?.submittedAt ?? null;

  return NextResponse.json({
    data: {
      approvalStatus: agent.approvalStatus,
      rejectionReason: agent.rejectionReason,
      openInfoRequest: agent.infoRequests[0] ?? null,
      submittedAt,
      editable: isRegistrationEditable(agent.approvalStatus, submittedAt),
      registration: registrationToForm(agent.businessRegistration),
    },
  });
}

// Save a draft (any step). Completeness is only enforced on submit.
export async function PUT(req: NextRequest) {
  const loaded = await loadOwnAgent();
  if ("error" in loaded) return loaded.error;
  const { agent } = loaded;

  if (!isRegistrationEditable(agent.approvalStatus, agent.businessRegistration?.submittedAt)) {
    return NextResponse.json({ error: "Your registration is under review and can't be changed right now." }, { status: 409 });
  }

  const parsed = registrationDraftSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }
  const data = {
    ...parsed.data,
    ...(parsed.data.sourceCountries ? { sourceCountries: parsed.data.sourceCountries.slice(0, MAX_SOURCE_COUNTRIES) } : {}),
    ...(parsed.data.consentAccepted === false ? { consentAt: null } : {}),
  };

  const saved = await db.subAgentBusinessRegistration.upsert({
    where: { subAgentId: agent.id },
    create: { subAgentId: agent.id, ...data },
    update: data,
  });

  return NextResponse.json({ data: { registration: registrationToForm(saved) } });
}

// Submit for review: every required answer and document, including the British Council certificate.
export async function POST() {
  const loaded = await loadOwnAgent();
  if ("error" in loaded) return loaded.error;
  const { agent, session } = loaded;
  const registration = agent.businessRegistration;

  if (!isRegistrationEditable(agent.approvalStatus, registration?.submittedAt)) {
    return NextResponse.json({ error: "Your registration has already been submitted." }, { status: 409 });
  }

  const missing = getMissingFields(registrationToForm(registration));
  if (!registration || missing.length > 0) {
    return NextResponse.json({ error: "Please complete every required question before submitting.", missing }, { status: 400 });
  }

  const wasInfoRequested = agent.approvalStatus === "INFO_REQUESTED";
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      await tx.subAgentBusinessRegistration.update({
        where: { subAgentId: agent.id },
        data: { submittedAt: now, consentAt: registration.consentAt ?? now },
      });

      if (wasInfoRequested) {
        // Back into the review queue; the update counts as the reply to open info requests.
        await tx.subAgent.updateMany({
          where: { id: agent.id, approvalStatus: "INFO_REQUESTED" },
          data: { approvalStatus: "PENDING" },
        });
        await tx.subAgentInfoRequest.updateMany({
          where: { subAgentId: agent.id, agentResponse: null },
          data: { agentResponse: "Updated and resubmitted the business registration.", respondedAt: now },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "SubAgent",
          entityId: agent.id,
          action: wasInfoRequested ? "BUSINESS_REGISTRATION_RESUBMITTED" : "BUSINESS_REGISTRATION_SUBMITTED",
          details: `Business registration ${wasInfoRequested ? "resubmitted" : "submitted"} for ${agent.agencyName}.`,
        },
      });
    });
  } catch (error) {
    console.error("[agent business-registration submit]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const reviewUrl = `/dashboard/sub-agents/applications/${agent.id}`;
  const verb = wasInfoRequested ? "resubmitted" : "submitted";
  const adminUsers = await db.user.findMany({
    where: { role: { name: { in: ["ADMIN", "MANAGER"] } }, isActive: true },
    select: { id: true },
  });
  await Promise.all([
    ...adminUsers.map((admin) =>
      NotificationService.createNotification({
        userId: admin.id,
        type: "SUB_AGENT_REGISTRATION_SUBMITTED",
        message: `${agent.agencyName} ${verb} their business registration for review.`,
        linkUrl: reviewUrl,
        actorUserId: session.user.id,
      }).catch(() => undefined),
    ),
    sendResendEmail({
      to: process.env.ADMIN_INBOX_EMAIL || "admin@eduquantica.com",
      subject: `Business registration ${verb}: ${agent.agencyName}`,
      html: `<p>${agent.agencyName} has ${verb} their sub-agent business registration, including their British Council certificate.</p><p>Review it in the CRM: ${process.env.NEXTAUTH_URL ?? ""}${reviewUrl}</p>`,
    }).catch(() => undefined),
  ]);

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
