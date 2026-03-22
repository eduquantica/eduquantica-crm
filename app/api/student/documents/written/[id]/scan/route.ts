import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { submitDocument } from "@/lib/copyleaks";
import { estimateFallbackAiScore, estimateFallbackPlagiarism } from "@/lib/written-documents";

function getWebhookUrl() {
  const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return base ? `${base}/api/webhooks/copyleaks` : "";
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const document = await db.studentDocument.findFirst({
    where: {
      id: params.id,
      student: { userId: session.user.id },
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!document.content.trim()) {
    return NextResponse.json({ error: "Document is empty" }, { status: 400 });
  }

  const scanId = `wd_${document.id}_${Date.now()}`;

  try {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      throw new Error("Webhook URL unavailable for Copyleaks callback");
    }

    await submitDocument(scanId, document.content, webhookUrl);

    await db.studentDocument.update({
      where: { id: document.id },
      data: {
        status: "SUBMITTED_FOR_SCAN",
        scanStatus: `SUBMITTED:${scanId}`,
      },
    });

    return NextResponse.json({
      data: {
        scanStatus: "SUBMITTED",
        scanId,
        message: "Scan submitted. Results will appear shortly.",
      },
    });
  } catch (error) {
    const plagiarismScore = estimateFallbackPlagiarism(document.content);
    const aiContentScore = estimateFallbackAiScore(document.content);

    const updated = await db.studentDocument.update({
      where: { id: document.id },
      data: {
        status: "SCAN_COMPLETE",
        scanStatus: "FALLBACK_COMPLETE",
        plagiarismScore,
        aiContentScore,
        scanCheckedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        scanStatus: updated.scanStatus,
        plagiarismScore: updated.plagiarismScore,
        aiContentScore: updated.aiContentScore,
        scanReportUrl: updated.scanReportUrl,
        sources: [],
        warning: "Copyleaks unavailable, fallback scoring applied.",
        debug: error instanceof Error ? error.message : "Unknown scan error",
      },
    });
  }
}
