import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDocumentScan } from "@/lib/document-scan-service";

const triggerScanSchema = z.object({
  checklistItemId: z.string().min(1, "checklistItemId is required"),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = triggerScanSchema.parse(await req.json());

    const checklistItem = await db.checklistItem.findUnique({
      where: { id: payload.checklistItemId },
      select: {
        id: true,
        documentId: true,
        checklist: {
          select: {
            student: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!checklistItem) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    if (!checklistItem.documentId) {
      return NextResponse.json(
        { error: "Checklist item has no linked document" },
        { status: 400 },
      );
    }

    const result = await runDocumentScan(payload.checklistItemId);

    return NextResponse.json({
      data: {
        checklistItemId: result.checklistItemId,
        studentName: `${checklistItem.checklist.student.firstName} ${checklistItem.checklist.student.lastName}`.trim(),
        ocrStatus: result.ocrStatus,
        fraudRiskLevel: result.fraudRiskLevel,
        fraudFlags: result.fraudFlags,
        ocrConfidence: result.ocrConfidence,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid payload" },
        { status: 400 },
      );
    }

    console.error("[/api/admin/checklist-scan POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
