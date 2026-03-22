import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const students = await db.student.findMany({
    where: { subAgentId: subAgent.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      communications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          message: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const data = await Promise.all(
    students.map(async (student) => {
      const unread = await db.communication.count({
        where: {
          studentId: student.id,
          isRead: false,
          NOT: { userId: session.user.id },
        },
      });

      const latest = student.communications[0] || null;
      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        unreadCount: unread,
        latestMessage: latest?.message || "",
        latestAt: latest?.createdAt?.toISOString() || null,
      };
    })
  );

  return NextResponse.json({ data });
}
