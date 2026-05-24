/**
 * Shared utilities for importing Facebook Lead Ads data into the CRM.
 * Used by both the webhook handler and the backfill endpoint.
 */

import { db } from "@/lib/db";
import { getNextCounsellor } from "@/lib/counsellor";
import { sendResendEmail } from "@/lib/resend";

export interface FieldData {
  name: string;
  values: string[];
}

export function findField(fieldData: FieldData[] | undefined, key: string): string | null {
  if (!fieldData) return null;
  const match = fieldData.find((item) => item.name.toLowerCase() === key.toLowerCase());
  return match?.values?.[0] || null;
}

export interface LeadMeta {
  leadgenId?: string;
  formId?: string;
  adId?: string;
}

/**
 * Creates a lead from Facebook field_data, skipping duplicates by email.
 * Returns { created: true, leadId } for new leads or { created: false, leadId } for dupes.
 * If email is missing, returns { created: false, leadId: "" }.
 */
export async function upsertLeadFromFieldData(
  fieldData: FieldData[],
  meta: LeadMeta
): Promise<{ created: boolean; leadId: string }> {
  const findF = (key: string) => findField(fieldData, key);

  const fullName = findF("full_name");
  const firstName = findF("first_name") || fullName?.split(" ").slice(0, 1).join(" ") || "Unknown";
  const lastName = findF("last_name") || fullName?.split(" ").slice(1).join(" ") || "";
  const email = findF("email");
  const phone = findF("phone_number") || findF("phone");
  const subAgentHint = findF("sub_agent_id") || findF("utm_content") || null;

  if (!email) return { created: false, leadId: "" };

  const normalizedEmail = email.toLowerCase();

  const existing = await db.lead.findFirst({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) return { created: false, leadId: existing.id };

  const counsellor = await getNextCounsellor();
  const subAgentId = await resolveSubAgentId(subAgentHint);

  const lead = await db.lead.create({
    data: {
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      source: "FACEBOOK",
      status: "NEW",
      notes: `lead_id=${meta.leadgenId || ""}; form_id=${meta.formId || ""}`,
      ...(counsellor ? { assignedCounsellorId: counsellor.id } : {}),
      ...(subAgentId ? { subAgentId } : {}),
    },
  });

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

  if (counsellor?.email) {
    try {
      await sendResendEmail({
        to: counsellor.email,
        subject: `New Facebook lead: ${lead.firstName} ${lead.lastName} - ${lead.email}`,
        html: `<p>New Facebook lead assigned.</p><p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p><p><strong>Email:</strong> ${lead.email}</p><p><strong>Phone:</strong> ${lead.phone || "-"}</p>`,
      });
    } catch (e) {
      console.error("[fb-leads] Failed to notify counsellor:", e);
    }
  }

  return { created: true, leadId: lead.id };
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
