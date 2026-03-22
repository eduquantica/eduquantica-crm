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

  const leadId = params.id;

  // permission check
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.user.roleName === "COUNSELLOR") {
    if (lead.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const messagesRaw = await db.communication.findMany({
    where: { leadId },
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

  // mark messages as read if they were inbound
  // mark inbound messages read (cast because Prisma client may not have been regenerated yet)
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

  const leadId = params.id;
  const body = await req.json();
  const { type, message, subject } = body;

  const commRaw = await db.communication.create({
    data: {
      leadId,
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

  // optional: log activity
  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "communication",
      entityId: communication.id,
      action: "created",
      details: `Sent message to lead ${leadId}`,
    },
  });

  return NextResponse.json({ communication }, { status: 201 });
}
