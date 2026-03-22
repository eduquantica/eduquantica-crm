import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ messages: [] });
  }

  const studentId = params.id;

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.user.roleName === "COUNSELLOR") {
    if (student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const messagesRaw = await db.communication.findMany({
    where: { studentId },
    include: { user: { select: { id: true, name: true, role: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const messages = messagesRaw.map((m) => ({
    ...m,
    user: {
      id: m.user.id,
      name: m.user.name,
      roleName: m.user.role?.name || "",
    },
  }));

  // mark inbound messages read
  // note: unread/read tracking could be added here once schema/client sync is ensured

  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const studentId = params.id;
  const body = await req.json();
  const { type, message, subject } = body;

  const commRaw = await db.communication.create({
    data: {
      studentId,
      userId: session.user.id,
      type: type || "NOTE",
      subject: subject || null,
      message,
      direction: "OUTBOUND",
    },
    include: { user: { select: { id: true, name: true, role: { select: { name: true } } } } },
  });
  const communication = {
    ...commRaw,
    user: {
      id: commRaw.user.id,
      name: commRaw.user.name,
      roleName: commRaw.user.role?.name || "",
    },
  };

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "communication",
      entityId: communication.id,
      action: "created",
      details: `Sent message to student ${studentId}`,
    },
  });

  return NextResponse.json({ communication }, { status: 201 });
}
