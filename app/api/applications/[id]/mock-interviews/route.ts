import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMockInterviewAccessContextByApplication } from "@/lib/mock-interview-access";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const access = await getMockInterviewAccessContextByApplication(session, params.id);

  if (!access) return NextResponse.json({ error: "Application not found or access denied" }, { status: 404 });

  const rows = await db.mockInterview.findMany({
    where: { applicationId: params.id },
    include: {
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
          generatedAt: true,
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return NextResponse.json({ data: rows });
}
