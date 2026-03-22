import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { FlagColour } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateFlag } from "@/lib/copyleaks";
import { sendMail } from "@/lib/email";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickFirstNumber(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parts = key.split(".");
    let current: unknown = payload;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }

    const asNumber = toNumber(current);
    if (asNumber !== null) return asNumber;
  }

  return null;
}

function pickFirstString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const parts = key.split(".");
    let current: unknown = payload;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (typeof current === "string" && current.trim() !== "") {
      return current;
    }
  }

  return null;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const normalized = signature.replace(/^sha256=/i, "").trim();
  if (!normalized) return false;

  const hexDigest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const base64Digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const candidates = [hexDigest, base64Digest];
  for (const candidate of candidates) {
    const a = Buffer.from(candidate);
    const b = Buffer.from(normalized);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.COPYLEAKS_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "COPYLEAKS_WEBHOOK_SECRET is not configured" }, { status: 500 });
    }

    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("x-copyleaks-signature") ||
      request.headers.get("x-signature") ||
      request.headers.get("signature") ||
      "";

    if (!verifySignature(rawBody, signatureHeader, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const payload = (JSON.parse(rawBody) || {}) as Record<string, unknown>;
    const scanId = pickFirstString(payload, ["scanId", "scan.id", "id"]);

    if (!scanId) {
      return NextResponse.json({ error: "scanId is required" }, { status: 400 });
    }

    const existingScan = await db.documentScanResult.findFirst({
      where: { scanId },
      include: {
        document: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                assignedCounsellorId: true,
              },
            },
          },
        },
      },
    });

    const plagiarismScore = pickFirstNumber(payload, [
      "plagiarismScore",
      "plagiarism",
      "results.plagiarism",
      "results.similarity",
      "results.similarityScore",
    ]);

    const aiScore = pickFirstNumber(payload, [
      "aiScore",
      "aiGeneratedScore",
      "results.aiScore",
      "results.aiGenerated",
      "results.aiGeneratedProbability",
    ]);

    const reportUrl =
      pickFirstString(payload, ["reportUrl", "resultUrl", "url", "results.reportUrl", "results.url"]);

    if (!existingScan) {
      const writtenDocument = await db.studentDocument.findFirst({
        where: {
          scanStatus: `SUBMITTED:${scanId}`,
        },
      });

      if (!writtenDocument) {
        return NextResponse.json({ error: "Scan record not found" }, { status: 404 });
      }

      await db.studentDocument.update({
        where: { id: writtenDocument.id },
        data: {
          status: "SCAN_COMPLETE",
          scanStatus: "COMPLETED",
          plagiarismScore,
          aiContentScore: aiScore,
          scanReportUrl: reportUrl,
          scanCheckedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true, status: "COMPLETED", target: "student_document" });
    }

    const statusValue = typeof payload.status === "string" ? payload.status.toLowerCase() : "";

    if (statusValue.includes("fail") || statusValue.includes("error")) {
      await db.documentScanResult.update({
        where: { id: existingScan.id },
        data: {
          status: "FAILED",
          reportUrl,
        },
      });

      return NextResponse.json({ ok: true, status: "FAILED" });
    }

    const settings =
      (await db.scanSettings.findFirst({
        orderBy: { id: "asc" },
        select: {
          plagiarismGreenMax: true,
          plagiarismAmberMax: true,
          aiGreenMax: true,
          aiAmberMax: true,
          autoApproveGreen: true,
          autoAlertAdmin: true,
        },
      })) || {
        plagiarismGreenMax: 15,
        plagiarismAmberMax: 30,
        aiGreenMax: 20,
        aiAmberMax: 40,
        autoApproveGreen: false,
        autoAlertAdmin: true,
      };

    const flagColour = calculateFlag(plagiarismScore, aiScore, settings);

    const autoApproveGreen = settings.autoApproveGreen && flagColour === FlagColour.GREEN;
    const shouldLock = autoApproveGreen && ["SOP", "PERSONAL_STATEMENT"].includes(existingScan.document.type);

    await db.$transaction(async (tx) => {
      await tx.documentScanResult.update({
        where: { id: existingScan.id },
        data: {
          status: "COMPLETED",
          plagiarismScore,
          aiScore,
          flagColour,
          reportUrl,
          scannedAt: new Date(),
          counsellorDecision: autoApproveGreen ? "ACCEPTED" : existingScan.counsellorDecision,
          reviewedAt: autoApproveGreen ? new Date() : existingScan.reviewedAt,
          isLocked: shouldLock ? true : existingScan.isLocked,
        },
      });

      if (autoApproveGreen) {
        await tx.document.update({
          where: { id: existingScan.documentId },
          data: { status: "VERIFIED" },
        });
      }

      if (existingScan.document.student.assignedCounsellorId) {
        const studentName = `${existingScan.document.student.firstName} ${existingScan.document.student.lastName}`.trim();
        await tx.activityLog.create({
          data: {
            userId: existingScan.document.student.assignedCounsellorId,
            entityType: "document",
            entityId: existingScan.documentId,
            action: "scan_complete_notification",
            details: `Scan complete for ${studentName} - ${flagColour}`,
          },
        });
      }
    });

    if (flagColour === FlagColour.RED && settings.autoAlertAdmin) {
      const admins = await db.user.findMany({
        where: {
          isActive: true,
          role: { name: "ADMIN" },
        },
        select: { email: true },
      });

      const studentName = `${existingScan.document.student.firstName} ${existingScan.document.student.lastName}`.trim();
      await Promise.all(
        admins
          .map((admin) => admin.email)
          .filter((email): email is string => Boolean(email))
          .map((email) =>
            sendMail({
              to: email,
              subject: `URGENT: RED scan flag for ${studentName}`,
              text: `Copyleaks scan completed with RED flag for ${studentName}.\nDocument type: ${existingScan.document.type}.\nPlagiarism score: ${plagiarismScore ?? "N/A"}%.\nAI score: ${aiScore ?? "N/A"}%.\nReport: ${reportUrl ?? "N/A"}`,
            }),
          ),
      );
    }

    return NextResponse.json({ ok: true, status: "COMPLETED" });
  } catch (error) {
    console.error("[/api/webhooks/copyleaks POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
