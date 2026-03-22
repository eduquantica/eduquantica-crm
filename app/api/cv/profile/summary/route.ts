import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateProfileSummary } from "@/lib/cv-summary-generator";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { studentId?: string };
  const studentId = body.studentId?.trim();

  let userId = session.user.id;
  if (studentId) {
    if (session.user.roleName === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        assignedCounsellorId: true,
        subAgentId: true,
      },
    });

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "SUB_AGENT") {
      const me = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } });
      if (!me || student.subAgentId !== me.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    userId = student.userId;
  }

  const profile = await db.cvProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "CV profile not found" }, { status: 404 });
  }

  const summary = await generateProfileSummary(profile.id);

  await db.cvProfile.update({
    where: { id: profile.id },
    data: { profileSummary: summary },
  });

  return NextResponse.json({ data: { summary } });
}
