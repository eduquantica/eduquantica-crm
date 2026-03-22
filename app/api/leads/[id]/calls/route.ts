import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"]);
const OUTCOMES = new Set(["ANSWERED", "NO_ANSWER", "VOICEMAIL", "BUSY", "WRONG_NUMBER"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(session.user.roleName)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const outcome = String(body.outcome || "").trim().toUpperCase();
  const duration = Number(body.duration || 0);
  const notes = String(body.notes || "").trim();
  const callDateTime = body.callDateTime ? new Date(body.callDateTime) : new Date();

  if (!OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: "Invalid call outcome" }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const communication = await db.communication.create({
    data: {
      leadId: lead.id,
      userId: session.user.id,
      type: "CALL",
      direction: "OUTBOUND",
      subject: `Call - ${outcome}`,
      message: JSON.stringify({
        callDateTime: callDateTime.toISOString(),
        duration,
        outcome,
        notes,
      }),
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: communication }, { status: 201 });
}
