import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import os from "node:os";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const createSessionSchema = z.object({
  studentId: z.string().min(1),
  documentField: z.string().min(1),
  documentType: z.string().min(1),
});

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

function buildQrOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";

  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    const lanIp = getLanIp();
    if (lanIp) {
      const port = host.includes(":") ? host.split(":")[1] : "3000";
      return `${proto}://${lanIp}:${port}`;
    }
  }

  return `${proto}://${host}`;
}

async function canAccessStudent(userId: string, roleName: string | undefined, studentId: string) {
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;

  if (roleName === "STUDENT") {
    const student = await db.student.findFirst({
      where: { id: studentId, userId },
      select: { id: true },
    });
    return Boolean(student);
  }

  if (roleName === "COUNSELLOR") {
    const student = await db.student.findFirst({
      where: { id: studentId, assignedCounsellorId: userId },
      select: { id: true },
    });
    return Boolean(student);
  }

  if (roleName === "SUB_AGENT") {
    const subAgent = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    if (!subAgent) return false;
    const student = await db.student.findFirst({
      where: { id: studentId, subAgentId: subAgent.id },
      select: { id: true },
    });
    return Boolean(student);
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const payload = createSessionSchema.parse(await req.json());

    const hasAccess = await canAccessStudent(session.user.id, session.user.roleName, payload.studentId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let checklistItemId: string | null = null;
    if (payload.documentType === "CHECKLIST_ITEM") {
      const checklistItem = await db.checklistItem.findFirst({
        where: {
          id: payload.documentField,
          checklist: { studentId: payload.studentId },
        },
        select: { id: true },
      });

      if (!checklistItem) {
        return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
      }

      checklistItemId = checklistItem.id;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await db.mobileUploadSession.updateMany({
      where: {
        studentId: payload.studentId,
        documentField: payload.documentField,
        status: { in: ["PENDING", "UPLOADING"] },
      },
      data: { status: "EXPIRED" },
    });

    const created = await db.mobileUploadSession.create({
      data: {
        checklistItemId,
        studentId: payload.studentId,
        createdById: session.user.id,
        documentField: payload.documentField,
        documentType: payload.documentType,
        status: "PENDING",
        expiresAt,
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({
      token: created.token,
      sessionId: created.id,
      expiresAt: created.expiresAt,
      qrUrl: `${buildQrOrigin(req)}/mobile-upload?token=${encodeURIComponent(created.token)}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/mobile-upload/create-session POST]", error);
    return NextResponse.json({ error: "Failed to create mobile upload session" }, { status: 500 });
  }
}
