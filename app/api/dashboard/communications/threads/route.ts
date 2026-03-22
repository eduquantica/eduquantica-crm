import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// filter tab values
// (we declared the list for clarity but only the type is used)
type Filter = "ALL" | "EMAIL" | "NOTE" | "CALL" | "UNREAD";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ threads: [] });
  }

  // check role from session
  const isCounsellor = session.user.roleName === "COUNSELLOR";

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const filter = (url.searchParams.get("filter") || "ALL").toUpperCase() as Filter;

  // build base where clause for communications
  // generic where clause, keys added dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (isCounsellor) {
    const uid = session.user.id;
    where.OR = [
      { lead: { assignedCounsellorId: uid } },
      { student: { assignedCounsellorId: uid } },
    ];
  }

  if (filter && filter !== "ALL" && filter !== "UNREAD") {
    where.type = filter;
  }

  if (search) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { message: { contains: search, mode: "insensitive" } },
          {
            lead: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          {
            student: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
    ];
  }

  // fetch communications ordered by most recent first
  const comms = await db.communication.findMany({
    where,
    include: {
      lead: { select: { id: true, firstName: true, lastName: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // group into threads
  const threadsMap = new Map<string, {
    type: "lead" | "student";
    id: string;
    name: string;
    lastMessage: string;
    lastAt: string;
    unreadCount: number;
    lastMessageType: string;
  }>();

  comms.forEach((c) => {
    const ttype = c.leadId ? "lead" : c.studentId ? "student" : null;
    if (!ttype) return;
    const tid = c.leadId || c.studentId!;
    const key = `${ttype}:${tid}`;
    const name = c.leadId
      ? `${c.lead?.firstName || ""} ${c.lead?.lastName || ""}`.trim()
      : `${c.student?.firstName || ""} ${c.student?.lastName || ""}`.trim();
    if (!threadsMap.has(key)) {
      threadsMap.set(key, {
        type: ttype,
        id: tid,
        name: name || "(no name)",
        lastMessage: c.message,
        lastAt: c.createdAt.toISOString(),
        unreadCount: 0,
        lastMessageType: c.type,
      });
    }
    // compute a simple unread count: any inbound messages
    if (c.direction === "INBOUND") {
      const thread = threadsMap.get(key)!;
      thread.unreadCount += 1;
    }
  });

  let threads = Array.from(threadsMap.values());

  if (filter === "UNREAD") {
    threads = threads.filter((t) => t.unreadCount > 0);
  }

  return NextResponse.json({ threads });
}
