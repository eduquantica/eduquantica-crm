import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.mockInterview.findMany({
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      application: {
        select: {
          id: true,
          course: { select: { name: true, university: { select: { name: true, country: true } } } },
        },
      },
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
          generatedAt: true,
        },
      },
      assignedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({ data: rows });
}
