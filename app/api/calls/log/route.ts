import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";

const CALL_OUTCOMES = [
  "ANSWERED",
  "NO_ANSWER",
  "VOICEMAIL",
  "CALLBACK_REQUESTED",
  "WRONG_NUMBER",
];

const CALL_DIRECTIONS = ["OUTBOUND", "INBOUND"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkPermission(session, "students", "canEdit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { studentId, direction, outcome, duration, notes, followUpNeeded, callDateTime } = body;

  // Validate inputs
  if (!studentId || !direction || !outcome) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!CALL_DIRECTIONS.includes(direction) || !CALL_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "Invalid direction or outcome" }, { status: 400 });
  }

  try {
    // Verify student exists
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { assignedCounsellor: true, subAgent: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Create log entry in ActivityLog
    const logEntry = await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "call",
        entityId: studentId,
        action: "logged",
        details: JSON.stringify({
          direction,
          outcome,
          duration: duration || 0,
          notes: notes || "",
          callDateTime: callDateTime || new Date().toISOString(),
        }),
      },
    });

    // Create follow-up task if requested
    if (followUpNeeded) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2); // 2 days from now
      dueDate.setHours(9, 0, 0, 0); // Set to 9 AM

      await db.task.create({
        data: {
          userId: student.assignedCounsellorId || session.user.id,
          studentId: studentId,
          title: `Follow up from call on ${new Date(callDateTime || Date.now()).toLocaleDateString()}`,
          description: `Call outcome: ${outcome}. ${notes ? `Notes: ${notes}` : ""}`,
          dueDate,
          priority: "MEDIUM",
          status: "PENDING",
        },
      });
    }

    return NextResponse.json({
      success: true,
      logId: logEntry.id,
    });
  } catch (err) {
    const error = err as Error;
    console.error("[POST /api/calls/log]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
