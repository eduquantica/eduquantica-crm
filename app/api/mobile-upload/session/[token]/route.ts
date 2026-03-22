import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const mobileSession = await db.mobileUploadSession.findUnique({
      where: { token: params.token },
      include: {
        checklistItem: {
          select: {
            id: true,
            label: true,
            conditionalNote: true,
          },
        },
      },
    });

    if (!mobileSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!mobileSession.checklistItem) {
      return NextResponse.json({ error: "Checklist session not found" }, { status: 404 });
    }

    const expired = isExpired(mobileSession.expiresAt) || mobileSession.status === "EXPIRED";

    if (expired) {
      if (mobileSession.status !== "EXPIRED") {
        await db.mobileUploadSession.update({
          where: { id: mobileSession.id },
          data: { status: "EXPIRED" },
        });
      }
      return NextResponse.json({
        checklistItem: {
          id: mobileSession.checklistItem.id,
          name: mobileSession.checklistItem.label,
          description: mobileSession.checklistItem.conditionalNote || "",
        },
        studentId: mobileSession.studentId,
        status: "EXPIRED",
        isExpired: true,
      }, { status: 410 });
    }

    return NextResponse.json({
      checklistItem: {
        id: mobileSession.checklistItem.id,
        name: mobileSession.checklistItem.label,
        description: mobileSession.checklistItem.conditionalNote || "",
      },
      studentId: mobileSession.studentId,
      status: mobileSession.status,
      isExpired: false,
      uploadedFileName: mobileSession.uploadedFileName,
      expiresAt: mobileSession.expiresAt,
    });
  } catch (error) {
    console.error("[/api/mobile-upload/session/[token] GET]", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const mobileSession = await db.mobileUploadSession.findUnique({
      where: { token: params.token },
      select: { id: true, createdById: true, status: true },
    });

    if (!mobileSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (mobileSession.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (mobileSession.status === "COMPLETED") {
      return NextResponse.json({ error: "Completed sessions cannot be cancelled" }, { status: 400 });
    }

    await db.mobileUploadSession.update({
      where: { id: mobileSession.id },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/mobile-upload/session/[token] DELETE]", error);
    return NextResponse.json({ error: "Failed to cancel session" }, { status: 500 });
  }
}
