import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { upsertLeadFromFieldData } from "@/lib/facebook-leads";

// ─── Graph API ────────────────────────────────────────────────────────────────

interface GraphLeadResponse {
  id: string;
  field_data?: Array<{ name: string; values: string[] }>;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  error?: { message: string; code: number };
}

/**
 * Fetch full lead field_data from the Graph API using the leadgen_id.
 * Facebook webhook notifications only contain the ID — the actual
 * field_data (name, email, phone) must be retrieved in a second call.
 */
async function fetchLeadFromGraph(leadgenId: string): Promise<GraphLeadResponse | null> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.error("[fb-webhook] FACEBOOK_PAGE_ACCESS_TOKEN not set");
    return null;
  }
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,created_time,form_id,ad_id&access_token=${token}`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as GraphLeadResponse;
    if (data.error) {
      console.error("[fb-webhook] Graph API error:", data.error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[fb-webhook] Graph API fetch failed:", err);
    return null;
  }
}

// ─── HMAC signature verification ─────────────────────────────────────────────

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) return true; // allow through in dev if not configured

  const signature = req.headers.get("x-hub-signature-256");
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

// ─── GET — webhook verification challenge ────────────────────────────────────

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

// ─── POST — lead notification ─────────────────────────────────────────────────

export async function POST(req: Request) {
  // Read raw body first so HMAC verification is possible
  const rawBody = await req.text();

  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    console.warn("[fb-webhook] Invalid HMAC signature — rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = (payload as Record<string, unknown>)?.entry as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ success: true, message: "No entries" }, { status: 200 });
  }

  const results: Array<{ leadgenId: string; status: string }> = [];

  for (const entry of entries) {
    const changes = entry.changes as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (change.field !== "leadgen") continue;

      const value = change.value as Record<string, unknown> | undefined;
      // Facebook sends "leadgen_id" (not "lead_id") in the notification payload
      const leadgenId = typeof value?.leadgen_id === "string" ? value.leadgen_id : null;
      const formId = typeof value?.form_id === "string" ? value.form_id : null;
      const adId = typeof value?.ad_id === "string" ? value.ad_id : null;

      if (!leadgenId) {
        results.push({ leadgenId: "unknown", status: "skipped: no leadgen_id in payload" });
        continue;
      }

      // Fetch the actual lead field_data — not present in the notification itself
      const leadData = await fetchLeadFromGraph(leadgenId);
      if (!leadData?.field_data) {
        console.warn(`[fb-webhook] No field_data for leadgen_id=${leadgenId}`);
        results.push({ leadgenId, status: "skipped: graph fetch failed or no field_data" });
        continue;
      }

      const { created, leadId } = await upsertLeadFromFieldData(leadData.field_data, {
        leadgenId,
        formId: formId || leadData.form_id,
        adId: adId || leadData.ad_id,
      });

      results.push({
        leadgenId,
        status: created ? `created: ${leadId}` : leadId ? `duplicate: ${leadId}` : "skipped: no email",
      });
    }
  }

  return NextResponse.json({ success: true, results }, { status: 200 });
}
