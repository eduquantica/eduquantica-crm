import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNextCounsellor } from "@/lib/counsellor";
import { sendResendEmail } from "@/lib/resend";

function findField(fieldData: Array<{ name?: string; values?: string[] }> | undefined, key: string): string | null {
  if (!fieldData) return null;
  const match = fieldData.find((item) => (item.name || "").toLowerCase() === key.toLowerCase());
  const value = match?.values?.[0];
  return value || null;
}

function normalizeFacebookPayload(payload: unknown): {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  leadId: string | null;
  formId: string | null;
  subAgentHint: string | null;
} {
  const input = (payload || {}) as Record<string, unknown>;
  const changes =
    ((input.entry as Array<Record<string, unknown>> | undefined)?.[0]?.changes as Array<Record<string, unknown>> | undefined)?.[0] ||
    input;
  const value = (changes.value as Record<string, unknown> | undefined) || input;
  const fieldData = value.field_data as Array<{ name?: string; values?: string[] }> | undefined;

  const fullName =
    findField(fieldData, "full_name") ||
    (typeof value.full_name === "string" ? value.full_name : null) ||
    (typeof value.name === "string" ? value.name : null);

  const firstName =
    findField(fieldData, "first_name") ||
    (typeof value.first_name === "string" ? value.first_name : null) ||
    fullName?.split(" ").slice(0, 1).join(" ") ||
    "";

  const lastName =
    findField(fieldData, "last_name") ||
    (typeof value.last_name === "string" ? value.last_name : null) ||
    (fullName?.split(" ").slice(1).join(" ") || "");

  const email =
    findField(fieldData, "email") ||
    (typeof value.email === "string" ? value.email : null);

  const phone =
    findField(fieldData, "phone_number") ||
    (typeof value.phone_number === "string" ? value.phone_number : null) ||
    (typeof value.phone === "string" ? value.phone : null);

  const leadId =
    (typeof value.lead_id === "string" ? value.lead_id : null) ||
    (typeof input.lead_id === "string" ? input.lead_id : null);

  const formId =
    (typeof value.form_id === "string" ? value.form_id : null) ||
    (typeof input.form_id === "string" ? input.form_id : null);

  const subAgentHint =
    findField(fieldData, "sub_agent_id") ||
    (typeof value.sub_agent_id === "string" ? value.sub_agent_id : null) ||
    (typeof value.utm_content === "string" ? value.utm_content : null) ||
    (typeof input.utm_content === "string" ? input.utm_content : null);

  return { firstName, lastName, email, phone, leadId, formId, subAgentHint };
}

async function resolveSubAgentId(subAgentHint: string | null): Promise<string | null> {
  if (!subAgentHint) return null;

  const byId = await db.subAgent.findUnique({ where: { id: subAgentHint }, select: { id: true } });
  if (byId) return byId.id;

  const byReferral = await db.subAgent.findFirst({
    where: { referralCode: subAgentHint },
    select: { id: true },
  });
  return byReferral?.id || null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken === process.env.FACEBOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = normalizeFacebookPayload(payload);

  if (!normalized.email) {
    return NextResponse.json({ success: true, message: "Missing email, skipped" }, { status: 200 });
  }

  const existing = await db.lead.findFirst({
    where: { email: normalized.email.toLowerCase() },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ success: true, message: "Duplicate lead skipped" }, { status: 200 });
  }

  const counsellor = await getNextCounsellor();
  const subAgentId = await resolveSubAgentId(normalized.subAgentHint);

  const leadData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    source: "FACEBOOK";
    status: "NEW";
    notes: string | null;
    assignedCounsellorId?: string;
    subAgentId?: string;
  } = {
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    email: normalized.email.toLowerCase(),
    phone: normalized.phone,
    source: "FACEBOOK",
    status: "NEW",
    notes: `lead_id=${normalized.leadId || ""}; form_id=${normalized.formId || ""}`,
  };
  if (subAgentId) leadData.subAgentId = subAgentId;
  if (counsellor) leadData.assignedCounsellorId = counsellor.id;

  const lead = await db.lead.create({ data: leadData });

  const actor =
    counsellor?.id ||
    (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } }))?.id ||
    (await db.user.findFirst({ select: { id: true } }))?.id;

  if (counsellor?.id) {
    await db.activityLog.create({
      data: {
        userId: counsellor.id,
        entityType: "lead",
        entityId: lead.id,
        action: "lead_assigned_notification",
        details: `New Facebook lead assigned: ${lead.firstName} ${lead.lastName}${lead.email ? ` - ${lead.email}` : ""}`,
      },
    });
  }

  if (actor) {
    await db.activityLog.create({
      data: {
        userId: actor,
        entityType: "lead",
        entityId: lead.id,
        action: "lead_created_facebook",
        details: `Lead created from Facebook Lead Ads: ${lead.firstName} ${lead.lastName}`,
      },
    });
  }

  if (counsellor && counsellor.email) {
    try {
      await sendResendEmail({
        to: counsellor.email,
        subject: `New Facebook lead: ${lead.firstName} ${lead.lastName} - ${lead.email || "No email"}`,
        html: `<p>New Facebook lead assigned.</p><p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p><p><strong>Email:</strong> ${lead.email || "-"}</p><p><strong>Phone:</strong> ${lead.phone || "-"}</p>`,
      });
    } catch (e) {
      console.error("Failed to notify counsellor", e);
    }
  }

  return NextResponse.json({ success: true, leadId: lead.id }, { status: 200 });
}
