/**
 * POST /api/admin/facebook-backfill
 *
 * Fetches historical leads from a Facebook Lead Ads form via the Graph API
 * and imports them. Duplicates are skipped safely — safe to call repeatedly.
 *
 * Body: { formId: string; limit?: number }
 * FACEBOOK_PAGE_ACCESS_TOKEN must be set in env vars.
 * Only ADMIN users may call this endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { upsertLeadFromFieldData } from "@/lib/facebook-leads";

interface GraphLeadNode {
  id: string;
  field_data: Array<{ name: string; values: string[] }>;
  created_time: string;
  form_id?: string;
  ad_id?: string;
}

interface GraphLeadsPage {
  data: GraphLeadNode[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
  error?: { message: string; code: number };
}

async function fetchLeadsPage(
  formId: string,
  token: string,
  after?: string,
  pageLimit = 100
): Promise<GraphLeadsPage> {
  const params = new URLSearchParams({
    fields: "id,field_data,created_time,form_id,ad_id",
    access_token: token,
    limit: String(Math.min(pageLimit, 100)),
    ...(after ? { after } : {}),
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/${formId}/leads?${params}`);
  return res.json() as Promise<GraphLeadsPage>;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "FACEBOOK_PAGE_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  let body: { formId?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { formId, limit = 500 } = body;
  if (!formId) {
    return NextResponse.json({ error: "formId is required" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let fetched = 0;
  let cursor: string | undefined;

  do {
    const page = await fetchLeadsPage(formId, token, cursor, Math.min(100, limit - fetched));

    if (page.error) {
      return NextResponse.json(
        { error: "Graph API error", detail: page.error, created, skipped, fetched },
        { status: 502 }
      );
    }

    for (const lead of page.data) {
      if (fetched >= limit) break;
      fetched++;
      try {
        const result = await upsertLeadFromFieldData(lead.field_data || [], {
          leadgenId: lead.id,
          formId: lead.form_id || formId,
          adId: lead.ad_id,
        });
        if (result.created) created++;
        else skipped++;
      } catch (err) {
        console.error("[fb-backfill] Failed to upsert lead:", lead.id, err);
        errors++;
      }
    }

    cursor = page.paging?.cursors?.after;
    const hasMore = Boolean(page.paging?.next) && fetched < limit;
    if (!hasMore) break;
  } while (true);

  return NextResponse.json({ success: true, formId, fetched, created, skipped, errors });
}
