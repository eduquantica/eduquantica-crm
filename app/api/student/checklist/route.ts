import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveChecklistUiStatus } from "@/lib/checklist-portal";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const checklist = await db.documentChecklist.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
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
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        checklistId: null,
        verifiedCount: 0,
        totalCount: 0,
        completionPct: 0,
        allVerified: false,
        certificateUrl: null,
        items: [],
      },
    });
  }

  const items = checklist.items.map((item) => {
    const ui = resolveChecklistUiStatus(item);
    return {
      id: item.id,
      label: item.label,
      documentType: item.documentType,
      status: ui.status,
      reason: ui.reason,
      ocrStatus: item.ocrStatus,
      ocrData: item.ocrData,
      ocrConfidence: item.ocrConfidence,
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
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      checklistId: checklist.id,
      verifiedCount,
      totalCount,
      completionPct,
      allVerified,
      certificateUrl: checklist.signedPdfUrl || null,
      items,
    },
  });
}
