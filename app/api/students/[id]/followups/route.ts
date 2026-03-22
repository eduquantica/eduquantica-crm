import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER"]);
const TYPES = new Set(["CALL", "EMAIL", "MEETING", "WHATSAPP"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(session.user.roleName)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const followUpType = String(body.type || "").trim().toUpperCase();
  const notes = String(body.notes || "").trim();
  const followUpDateTime = body.followUpDateTime ? new Date(body.followUpDateTime) : null;

  if (!followUpDateTime || Number.isNaN(followUpDateTime.getTime())) {
    return NextResponse.json({ error: "Invalid follow-up date/time" }, { status: 400 });
  }
  if (!TYPES.has(followUpType)) {
    return NextResponse.json({ error: "Invalid follow-up type" }, { status: 400 });
  }

  const student = await db.student.findUnique({ where: { id: params.id }, select: { id: true, assignedCounsellorId: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const task = await db.task.create({
    data: {
      userId: student.assignedCounsellorId || session.user.id,
      studentId: student.id,
      title: `${followUpType} follow-up`,
      description: notes || null,
      dueDate: followUpDateTime,
      priority: "MEDIUM",
      status: "PENDING",
    },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}
