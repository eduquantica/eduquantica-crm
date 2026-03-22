import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDocumentInstructions, resolveChecklistUiStatus } from "@/lib/checklist-portal";
import { Prisma } from "@prisma/client";

const updateSchema = z.object({
  confirmed: z.boolean().optional(),
  corrections: z.record(z.string(), z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const item = await db.checklistItem.findFirst({
    where: {
      id: params.itemId,
      checklist: { studentId: student.id },
    },
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
  });

  if (!item) {
    return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  }

  const ui = resolveChecklistUiStatus(item);
  const guide = getDocumentInstructions(item.documentType);

  return NextResponse.json({
    data: {
      id: item.id,
      studentId: student.id,
      label: item.label,
      documentType: item.documentType,
      status: ui.status,
      reason: ui.reason,
      ocrStatus: item.ocrStatus,
      ocrData: item.ocrData,
      ocrConfidence: item.ocrConfidence,
      fileName: item.document?.fileName || null,
      fileUrl: item.document?.fileUrl || null,
      instructions: guide.instructions,
      exampleImage: guide.exampleImage,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  try {
    const payload = updateSchema.parse(await req.json());

    const item = await db.checklistItem.findFirst({
      where: {
        id: params.itemId,
        checklist: { studentId: student.id },
      },
      select: { id: true, ocrData: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    const currentData = typeof item.ocrData === "object" && item.ocrData !== null
      ? (item.ocrData as Record<string, unknown>)
      : {};

    const nextData: Record<string, unknown> = {
      ...currentData,
      studentFeedback: {
        confirmed: payload.confirmed ?? false,
        corrections: payload.corrections ?? {},
        updatedAt: new Date().toISOString(),
      },
    };

    await db.checklistItem.update({
      where: { id: item.id },
      data: {
        ocrData: nextData as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/student/checklist/[itemId] PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
