import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER"]);
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

  const student = await db.student.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const activity = await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "call",
      entityId: student.id,
      action: "logged",
      details: JSON.stringify({
        callDateTime: callDateTime.toISOString(),
        duration,
        outcome,
        notes,
      }),
    },
  });

  return NextResponse.json({ data: activity }, { status: 201 });
}
