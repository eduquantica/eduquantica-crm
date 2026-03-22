import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "studentOnboarding",
      entityId: student.id,
      action: "eduvi_started",
      details: JSON.stringify({ createdAt: new Date().toISOString() }),
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
