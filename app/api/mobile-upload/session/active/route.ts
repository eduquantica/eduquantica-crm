import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { MobileUploadStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  checklistItemId: z.string().optional(),
  studentId: z.string().optional(),
  documentField: z.string().optional(),
});

async function canAccessStudent(userId: string, roleName: string | undefined, studentId: string) {
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;

  if (roleName === "STUDENT") {
    const student = await db.student.findFirst({ where: { id: studentId, userId }, select: { id: true } });
    return Boolean(student);
  }

  if (roleName === "COUNSELLOR") {
    const student = await db.student.findFirst({ where: { id: studentId, assignedCounsellorId: userId }, select: { id: true } });
    return Boolean(student);
  }

  if (roleName === "SUB_AGENT") {
    const subAgent = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    if (!subAgent) return false;
    const student = await db.student.findFirst({ where: { id: studentId, subAgentId: subAgent.id }, select: { id: true } });
    return Boolean(student);
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      checklistItemId: searchParams.get("checklistItemId") || undefined,
      studentId: searchParams.get("studentId") || undefined,
      documentField: searchParams.get("documentField") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    if (!parsed.data.checklistItemId && !parsed.data.studentId) {
      return NextResponse.json({ error: "Missing checklistItemId or studentId" }, { status: 400 });
    }

    let studentId = parsed.data.studentId || "";
    const checklistItemId = parsed.data.checklistItemId || "";
    const documentField = parsed.data.documentField || "";

    if (checklistItemId) {
      const checklistItem = await db.checklistItem.findUnique({
        where: { id: checklistItemId },
        select: { checklist: { select: { studentId: true } } },
      });

      if (!checklistItem) {
        return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
      }
      studentId = checklistItem.checklist.studentId;
    }

    const hasAccess = await canAccessStudent(session.user.id, session.user.roleName, studentId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activeStatuses: MobileUploadStatus[] = [MobileUploadStatus.PENDING, MobileUploadStatus.UPLOADING];
    const activeWhere: Prisma.MobileUploadSessionWhereInput = checklistItemId
      ? { checklistItemId, status: { in: activeStatuses } }
      : documentField
        ? { studentId, documentField, status: { in: activeStatuses } }
        : { studentId, status: { in: activeStatuses } };

    await db.mobileUploadSession.updateMany({
      where: {
        ...activeWhere,
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });

    const active = await db.mobileUploadSession.findFirst({
      where: activeWhere,
      orderBy: { createdAt: "desc" },
      select: {
        checklistItemId: true,
        documentField: true,
        token: true,
        status: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({
      hasActiveSession: Boolean(active),
      checklistItemId: active?.checklistItemId || null,
      documentField: active?.documentField || null,
      status: active?.status || null,
      token: active?.token || null,
      expiresAt: active?.expiresAt || null,
    });
  } catch (error) {
    console.error("[/api/mobile-upload/session/active GET]", error);
    return NextResponse.json({ error: "Failed to fetch active session" }, { status: 500 });
  }
}
