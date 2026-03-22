import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNextCounsellor } from "@/lib/counsellor";

type LeadImportRow = {
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  country_of_residence?: string;
  source?: string;
  interested_in?: string;
  preferred_destination?: string;
  notes?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const rows = (body.rows || []) as LeadImportRow[];

  if (rows.length > 500) {
    return NextResponse.json({
      imported: 0,
      skipped_duplicate: 0,
      skipped_invalid: rows.length,
      errors: ["Maximum 500 leads allowed per import request"],
    }, { status: 400 });
  }

  let imported = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  const errors: string[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const firstName = (row.firstName || row.first_name || "").trim();
    const lastName = (row.lastName || row.last_name || "").trim();
    const email = (row.email || "").trim().toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      skippedInvalid += 1;
      errors.push(`Row ${index + 1}: invalid email`);
      continue;
    }

    const existing = await db.lead.findFirst({ where: { email }, select: { id: true } });
    if (existing) {
      skippedDuplicate += 1;
      continue;
    }

    try {
      const counsellor = await getNextCounsellor();
      await db.lead.create({
        data: {
          firstName,
          lastName,
          email,
          phone: row.phone || null,
          nationality: row.nationality || null,
          interestedCountry: row.country_of_residence || null,
          source: (row.source as "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "GOOGLE_ADS" | "WEBSITE" | "REFERRAL" | "WALK_IN") || "WEBSITE",
          interestedLevel: row.interested_in || null,
          campaign: row.preferred_destination || null,
          notes: row.notes || null,
          status: "NEW",
          assignedCounsellorId: counsellor?.id,
        },
      });
      imported += 1;
    } catch (error) {
      skippedInvalid += 1;
      errors.push(`Row ${index + 1}: failed to import`);
      console.error("Lead import row failed", error);
    }
  }

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "lead_import",
      entityId: "bulk",
      action: "bulk_import",
      details: `${imported} imported, ${skippedDuplicate} duplicates, ${skippedInvalid} invalid`,
    },
  });

  return NextResponse.json({
    imported,
    skipped_duplicate: skippedDuplicate,
    skipped_invalid: skippedInvalid,
    errors,
  });
}
