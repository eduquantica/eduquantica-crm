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

export interface LeadMeta {
  leadgenId?: string;
  formId?: string;
  adId?: string;
}

// ─── Known field names (lower-cased) — excluded from customFields ─────────────

const QUALIFICATION_FIELDS = ["last_academic_qualification", "educational_level", "educational_status_"];
const IELTS_BOOL_FIELDS    = ["do_you_have_ielts?"];
const IELTS_SCORE_FIELDS   = ["ielts_score", "ielts/alternatives_score_(if_any)"];

const KNOWN_FIELDS = new Set<string>([
  "full_name", "first_name", "last_name",
  "email", "phone_number", "phone",
  "sub_agent_id", "utm_content",
  "inbox_url",
  ...QUALIFICATION_FIELDS,
  ...IELTS_BOOL_FIELDS,
  ...IELTS_SCORE_FIELDS,
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function findField(fieldData: FieldData[] | undefined, key: string): string | null {
  if (!fieldData) return null;
  const match = fieldData.find((f) => f.name.toLowerCase() === key.toLowerCase());
  return match?.values?.[0] || null;
}

function findOneOf(fieldData: FieldData[], keys: string[]): string | null {
  for (const f of fieldData) {
    if (keys.includes(f.name.toLowerCase())) return f.values?.[0] || null;
  }
  return null;
}

function parseIelts(val: string | null): boolean | null {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  if (lower === "yes") return true;
  if (lower === "no")  return false;
  return null;
}

// Prisma Decimal fields accept plain numbers
function parseIeltsScore(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return null;
  return Math.min(Math.max(parseFloat(n.toFixed(1)), 0), 9.0);
}

function buildCustomFields(fieldData: FieldData[]): Record<string, string> | null {
  const extra: Record<string, string> = {};
  for (const f of fieldData) {
    if (!f.values?.[0]) continue;
    const nameLower = f.name.toLowerCase();
    if (IELTS_BOOL_FIELDS.includes(nameLower)) {
      // Standard yes/no goes into the hasIelts column — anything else (e.g. "planning_soon") is surfaced here
      const v = f.values[0].trim().toLowerCase();
      if (v !== "yes" && v !== "no") extra[f.name] = f.values[0];
      continue;
    }
    if (!KNOWN_FIELDS.has(nameLower)) extra[f.name] = f.values[0];
  }
  return Object.keys(extra).length > 0 ? extra : null;
}

async function resolveSubAgentId(hint: string | null): Promise<string | null> {
  if (!hint) return null;
  const byId = await db.subAgent.findUnique({ where: { id: hint }, select: { id: true } });
  if (byId) return byId.id;
  const byRef = await db.subAgent.findFirst({ where: { referralCode: hint }, select: { id: true } });
  return byRef?.id || null;
}

// ─── Main upsert ─────────────────────────────────────────────────────────────

/**
 * Creates a lead from Facebook field_data, skipping duplicates by email.
 * Maps known custom fields to typed columns; everything else goes to customFields JSON.
 */
export async function upsertLeadFromFieldData(
  fieldData: FieldData[],
  meta: LeadMeta
): Promise<{ created: boolean; leadId: string }> {
  const fullName  = findField(fieldData, "full_name");
  const firstName = findField(fieldData, "first_name") || fullName?.split(" ").slice(0, 1).join(" ") || "Unknown";
  const lastName  = findField(fieldData, "last_name")  || fullName?.split(" ").slice(1).join(" ")  || "";
  const email     = findField(fieldData, "email");
  const phone     = findOneOf(fieldData, ["phone_number", "phone"]);
  const subAgentHint  = findOneOf(fieldData, ["sub_agent_id", "utm_content"]);
  const qualification = findOneOf(fieldData, QUALIFICATION_FIELDS);
  const hasIelts      = parseIelts(findOneOf(fieldData, IELTS_BOOL_FIELDS));
  const ieltsScore    = parseIeltsScore(findOneOf(fieldData, IELTS_SCORE_FIELDS));
  const customFields  = buildCustomFields(fieldData);

  // Require at least a name and phone; email is optional
  if (!firstName && !fullName) return { created: false, leadId: "" };
  if (!phone) return { created: false, leadId: "" };

  const normalizedEmail = email ? email.toLowerCase() : null;

  // Dedup by email if present, otherwise by phone
  if (normalizedEmail) {
    const existing = await db.lead.findFirst({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) return { created: false, leadId: existing.id };
  } else {
    const existing = await db.lead.findFirst({ where: { phone }, select: { id: true } });
    if (existing) return { created: false, leadId: existing.id };
  }

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
      notes:  `lead_id=${meta.leadgenId || ""}; form_id=${meta.formId || ""}`,
      ...(qualification !== null ? { lastAcademicQualification: qualification } : {}),
      ...(hasIelts      !== null ? { hasIelts }                                : {}),
      ...(ieltsScore    !== null ? { ieltsScore }                              : {}),
      ...(customFields  !== null ? { customFields }                            : {}),
      ...(counsellor             ? { assignedCounsellorId: counsellor.id }    : {}),
      ...(subAgentId             ? { subAgentId }                             : {}),
    },
  });

  const actor =
    counsellor?.id ||
    (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } }))?.id ||
    (await db.user.findFirst({ select: { id: true } }))?.id;

  if (counsellor?.id) {
    await db.activityLog.create({
      data: {
        userId: counsellor.id, entityType: "lead", entityId: lead.id,
        action: "lead_assigned_notification",
        details: `New Facebook lead assigned: ${lead.firstName} ${lead.lastName}${lead.email ? ` - ${lead.email}` : ""}`,
      },
    });
  }
  if (actor) {
    await db.activityLog.create({
      data: {
        userId: actor, entityType: "lead", entityId: lead.id,
        action: "lead_created_facebook",
        details: `Lead created from Facebook Lead Ads: ${lead.firstName} ${lead.lastName}`,
      },
    });
  }

  if (counsellor?.email) {
    try {
      await sendResendEmail({
        to:      counsellor.email,
        subject: `New Facebook lead: ${lead.firstName} ${lead.lastName} - ${lead.email}`,
        html: [
          `<p>New Facebook lead assigned.</p>`,
          `<p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p>`,
          `<p><strong>Email:</strong> ${lead.email}</p>`,
          `<p><strong>Phone:</strong> ${lead.phone || "-"}</p>`,
          qualification ? `<p><strong>Qualification:</strong> ${qualification}</p>` : "",
          hasIelts !== null ? `<p><strong>Has IELTS:</strong> ${hasIelts ? "Yes" : "No"}</p>` : "",
          ieltsScore    ? `<p><strong>IELTS Score:</strong> ${ieltsScore}</p>`                : "",
        ].join(""),
      });
    } catch (e) {
      console.error("[fb-leads] Failed to notify counsellor:", e);
    }
  }

  return { created: true, leadId: lead.id };
}

/**
 * Patch custom fields onto an existing lead (used by retroactive backfill).
 */
export async function patchLeadCustomFields(leadId: string, fieldData: FieldData[]): Promise<void> {
  const qualification = findOneOf(fieldData, QUALIFICATION_FIELDS);
  const hasIelts      = parseIelts(findOneOf(fieldData, IELTS_BOOL_FIELDS));
  const ieltsScore    = parseIeltsScore(findOneOf(fieldData, IELTS_SCORE_FIELDS));
  const customFields  = buildCustomFields(fieldData);

  await db.lead.update({
    where: { id: leadId },
    data: {
      ...(qualification !== null ? { lastAcademicQualification: qualification } : {}),
      ...(hasIelts      !== null ? { hasIelts }                                : {}),
      ...(ieltsScore    !== null ? { ieltsScore }                              : {}),
      ...(customFields  !== null ? { customFields }                            : {}),
    },
  });
}
