import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNextCounsellor } from "@/lib/counsellor";

const API_KEY = process.env.API_KEY;

export async function POST(req: Request) {
  const provided = req.headers.get("x-api-key");
  if (!API_KEY || provided !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName =
    (typeof payload.first_name === "string" ? payload.first_name : null) ||
    (typeof payload.firstName === "string" ? payload.firstName : null) ||
    "";
  const lastName =
    (typeof payload.last_name === "string" ? payload.last_name : null) ||
    (typeof payload.lastName === "string" ? payload.lastName : null) ||
    "";
  const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
  const phone = typeof payload.phone === "string" ? payload.phone : null;
  const nationality = typeof payload.nationality === "string" ? payload.nationality : null;
  const message = typeof payload.message === "string" ? payload.message : null;

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const duplicate = await db.lead.findFirst({ where: { email }, select: { id: true } });
  if (duplicate) {
    return NextResponse.json({ success: true, message: "Thank you, we will be in touch." }, { status: 200 });
  }

  const counsellor = await getNextCounsellor();

  const leadData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    nationality: string | null;
    notes: string | null;
    source: "WEBSITE";
    status: "NEW";
    assignedCounsellorId?: string;
  } = {
    firstName,
    lastName,
    email,
    phone,
    nationality,
    notes: message,
    source: "WEBSITE",
    status: "NEW",
  };
  if (counsellor) leadData.assignedCounsellorId = counsellor.id;

  const lead = await db.lead.create({ data: leadData });

  const actor =
    counsellor?.id ||
    (await db.user.findFirst({ where: { role: { name: "ADMIN" } }, select: { id: true } }))?.id ||
    (await db.user.findFirst({ select: { id: true } }))?.id;

  if (actor) {
    await db.activityLog.create({
      data: {
        userId: actor,
        entityType: "lead",
        entityId: lead.id,
        action: "lead_created_website",
        details: `Lead created from website contact form: ${lead.firstName} ${lead.lastName}`,
      },
    });
  }

  return NextResponse.json({ success: true, message: "Thank you, we will be in touch." }, { status: 200 });
}
