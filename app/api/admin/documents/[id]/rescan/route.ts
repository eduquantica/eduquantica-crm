import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractTextFromUrl, submitDocument } from "@/lib/copyleaks";

const SCAN_ELIGIBLE_TYPES = new Set(["SOP", "PERSONAL_STATEMENT", "COVER_LETTER", "LOR"]);
const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await db.document.findUnique({
      where: { id: params.id },
      include: {
        student: { select: { assignedCounsellorId: true } },
        scanResult: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      document.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!SCAN_ELIGIBLE_TYPES.has(document.type)) {
      return NextResponse.json({ error: "This document type is not eligible for Copyleaks re-scan" }, { status: 400 });
    }

    if (document.scanResult?.isLocked) {
      return NextResponse.json({ error: "Scan is locked. Unlock it before re-scan." }, { status: 409 });
    }

    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: "NEXTAUTH_URL is not configured" }, { status: 500 });
    }

    const text = await extractTextFromUrl(document.fileUrl);
    const scanId = randomUUID();
    const webhookUrl = `${baseUrl}/api/webhooks/copyleaks?scanId=${encodeURIComponent(scanId)}&documentId=${encodeURIComponent(document.id)}`;

    await submitDocument(scanId, text, webhookUrl);

    await db.documentScanResult.upsert({
      where: { documentId: document.id },
      update: {
        scanId,
        status: "SCANNING",
        scannedAt: null,
      },
      create: {
        documentId: document.id,
        scanId,
        status: "SCANNING",
      },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "document",
        entityId: document.id,
        action: "document_rescan_triggered",
        details: `Re-scan triggered for ${document.type} with scanId ${scanId}`,
      },
    });

    return NextResponse.json({ data: { status: "SCANNING", scanId } });
  } catch (error) {
    console.error("[/api/admin/documents/[id]/rescan POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
