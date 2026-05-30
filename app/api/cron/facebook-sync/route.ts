import { NextRequest, NextResponse } from "next/server";
import { upsertLeadFromFieldData, FieldData } from "@/lib/facebook-leads";

export const runtime = "nodejs";
export const maxDuration = 60;

const FORM_IDS = [
  "1814351369538147", // Event Lead Form - UK
  "1005792141968551", // Event Lead Form - UK-copy
  "1337054211633998", // Event Lead Form - Malaysia-copy
  "947039668126126",  // Malaysia Event Lead Form
  "2151129889002539", // Multi Destination Education Fair (9th April)
  "2005568043668509", // Malaysia Fair Leads Form - 18th April
  "4242847039363817", // 18th April Malaysia Fair Leads Campaign
];

interface FbLead {
  id: string;
  created_time: string;
  field_data: FieldData[];
}

interface FbLeadsResponse {
  data?: FbLead[];
  error?: { message: string };
  paging?: { next?: string };
}

async function syncForm(
  formId: string,
  token: string,
  since: number
): Promise<{ created: number; skipped: number; error?: string }> {
  let created = 0;
  let skipped = 0;

  try {
    let url: string | null =
      `https://graph.facebook.com/v21.0/${formId}/leads` +
      `?fields=id,created_time,field_data&since=${since}&limit=50&access_token=${token}`;

    while (url) {
      const res = await fetch(url);
      const data = (await res.json()) as FbLeadsResponse;

      if (data.error) {
        console.error(`[cron/fb-sync] Form ${formId} API error:`, data.error.message);
        return { created: 0, skipped: 0, error: data.error.message };
      }

      // Upsert leads concurrently within each page
      await Promise.allSettled(
        (data.data ?? []).map(async (lead) => {
          try {
            const { created: wasCreated } = await upsertLeadFromFieldData(
              lead.field_data ?? [],
              { leadgenId: lead.id, formId }
            );
            if (wasCreated) created++;
            else skipped++;
          } catch (e) {
            console.error(`[cron/fb-sync] Failed to upsert lead ${lead.id}:`, e);
          }
        })
      );

      url = data.paging?.next ?? null;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron/fb-sync] Form ${formId} failed:`, msg);
    return { created: 0, skipped: 0, error: msg };
  }

  return { created, skipped };
}

export async function GET(req: NextRequest) {
  // Accept Vercel's built-in cron auth OR our CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "FACEBOOK_PAGE_ACCESS_TOKEN not set" }, { status: 500 });
  }

  // Fetch leads from last 15 minutes (3× the 5-min cron interval for overlap)
  const since = Math.floor(Date.now() / 1000) - 15 * 60;

  // Fetch all forms in parallel
  const results = await Promise.all(
    FORM_IDS.map((formId) => syncForm(formId, token, since))
  );

  const formResults: Record<string, { created: number; skipped: number; error?: string }> = {};
  let totalCreated = 0;
  let totalSkipped = 0;

  FORM_IDS.forEach((formId, i) => {
    formResults[formId] = results[i];
    totalCreated += results[i].created;
    totalSkipped += results[i].skipped;
  });

  if (totalCreated > 0) {
    console.log(`[cron/fb-sync] ${totalCreated} new leads imported from Facebook`);
  }

  return NextResponse.json({
    success: true,
    ranAt: new Date().toISOString(),
    created: totalCreated,
    skipped: totalSkipped,
    forms: formResults,
  });
}
