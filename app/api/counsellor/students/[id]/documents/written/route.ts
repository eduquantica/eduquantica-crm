import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      assignedCounsellorId: true,
      subAgentStaffId: true,
      subAgent: { select: { userId: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    session.user.roleName === "SUB_AGENT"
    && student.subAgent?.userId !== session.user.id
    && student.subAgentStaffId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await db.studentDocument.findMany({
    where: {
      studentId: student.id,
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      documentType: true,
      wordCount: true,
      grammarScore: true,
      plagiarismScore: true,
      aiContentScore: true,
      status: true,
      convertedPdfUrl: true,
      updatedAt: true,
      content: true,
    },
  });

  const data = documents.map((doc) => ({
    ...doc,
    aiScore: doc.aiContentScore,
    grammarStatus:
      doc.grammarScore == null
        ? "PENDING"
        : doc.grammarScore >= 80
          ? "GOOD"
          : doc.grammarScore >= 60
            ? "NEEDS_REVIEW"
            : "POOR",
  }));

  return NextResponse.json({ data });
}
