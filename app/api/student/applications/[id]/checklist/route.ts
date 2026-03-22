import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveChecklistUiStatus } from "@/lib/checklist-portal";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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

  const application = await db.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      studentId: true,
    },
  });

  if (!application || application.studentId !== student.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const checklist = await db.documentChecklist.findUnique({
    where: { applicationId: application.id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          document: {
            include: {
              scanResult: {
                select: {
                  status: true,
                  counsellorDecision: true,
                  counsellorNote: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!checklist) {
    return NextResponse.json({
      data: {
        checklistId: null,
        verifiedCount: 0,
        totalCount: 0,
        completionPct: 0,
        allVerified: false,
        items: [],
      },
    });
  }

  const items = checklist.items.map((item) => {
    const ui = resolveChecklistUiStatus(item);
    return {
      id: item.id,
      label: item.label,
      status: ui.status,
      reason: ui.reason,
      documentId: item.document?.id || null,
      fileName: item.document?.fileName || null,
      fileUrl: item.document?.fileUrl || null,
    };
  });

  const totalCount = items.length;
  const verifiedCount = items.filter((item) => item.status === "VERIFIED").length;
  const completionPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;
  const allVerified = totalCount > 0 && verifiedCount === totalCount;

  return NextResponse.json({
    data: {
      checklistId: checklist.id,
      verifiedCount,
      totalCount,
      completionPct,
      allVerified,
      items,
    },
  });
}
