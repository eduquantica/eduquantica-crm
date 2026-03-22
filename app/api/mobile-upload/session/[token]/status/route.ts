import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const mobileSession = await db.mobileUploadSession.findUnique({
      where: { token: params.token },
      select: {
        status: true,
        uploadedFileName: true,
        completedAt: true,
        expiresAt: true,
      },
    });

    if (!mobileSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if ((mobileSession.status === "PENDING" || mobileSession.status === "UPLOADING") && mobileSession.expiresAt.getTime() <= Date.now()) {
      const updated = await db.mobileUploadSession.update({
        where: { token: params.token },
        data: { status: "EXPIRED" },
        select: {
          status: true,
          uploadedFileName: true,
          completedAt: true,
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({
      status: mobileSession.status,
      uploadedFileName: mobileSession.uploadedFileName,
      completedAt: mobileSession.completedAt,
    });
  } catch (error) {
    console.error("[/api/mobile-upload/session/[token]/status GET]", error);
    return NextResponse.json({ error: "Failed to fetch session status" }, { status: 500 });
  }
}
