import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanGenericDoc, scanPassport } from "@/lib/mindee";

const postSchema = z.object({
  kind: z.enum(["PASSPORT", "ENGLISH_TEST", "OTHER_TEST"]),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
});

const patchSchema = z.object({
  documentId: z.string().min(1),
  confirmed: z.boolean(),
  correctedName: z.string().optional(),
  correctedNumber: z.string().optional(),
  correctedExpiry: z.string().optional(),
});

async function getStudent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!student) {
    return { error: NextResponse.json({ error: "Student profile not found" }, { status: 404 }) } as const;
  }

  return { session, student } as const;
}

async function readExtended(studentId: string) {
  const latest = await db.activityLog.findFirst({
    where: {
      entityType: "studentProfile",
      entityId: studentId,
      action: "upsert",
    },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });

  if (!latest?.details) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(latest.details);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export async function POST(req: Request) {
  const ctx = await getStudent();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = postSchema.parse(await req.json());
    const type = payload.kind === "PASSPORT" ? "PASSPORT" : payload.kind === "ENGLISH_TEST" ? "ENGLISH_TEST" : "OTHER";

    const existingDocument = await db.document.findFirst({
      where: {
        studentId: ctx.student.id,
        type,
      },
      orderBy: { uploadedAt: "desc" },
      select: { id: true },
    });

    const document = existingDocument
      ? await db.document.update({
          where: { id: existingDocument.id },
          data: {
            fileName: payload.fileName,
            fileUrl: payload.fileUrl,
            status: "PENDING",
          },
          select: { id: true, uploadedAt: true },
        })
      : await db.document.create({
          data: {
            studentId: ctx.student.id,
            type,
            fileName: payload.fileName,
            fileUrl: payload.fileUrl,
            status: "PENDING",
          },
          select: { id: true, uploadedAt: true },
        });

    if (payload.kind === "PASSPORT") {
      const result = await scanPassport(payload.fileUrl);
      const hasError = "error" in result;
      const usedAnthropicFallback = !hasError && result.source === "anthropic";
      const detected = hasError
        ? { name: "", number: "", expiry: "" }
        : {
            name: `${result.givenNames || ""} ${result.surname || ""}`.trim(),
            number: result.documentNumber || "",
            expiry: result.expiryDate || "",
          };

      const extended = await readExtended(ctx.student.id);
      const existingPassport =
        extended.passport && typeof extended.passport === "object"
          ? (extended.passport as Record<string, unknown>)
          : {};

      extended.passport = {
        ...existingPassport,
        ocrStatus: hasError ? "NEEDS_REVIEW" : "NEEDS_REVIEW",
        lastOcrName: detected.name,
        lastOcrNumber: detected.number,
        lastOcrExpiry: detected.expiry,
        lastDocumentId: document.id,
        passportFileUrl: payload.fileUrl,
        passportFileName: payload.fileName,
        passportUploadedAt: document.uploadedAt.toISOString(),
      };

      await db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          entityType: "studentProfile",
          entityId: ctx.student.id,
          action: "upsert",
          details: JSON.stringify(extended),
        },
      });

      return NextResponse.json({
        data: {
          documentId: document.id,
          ocrStatus: "NEEDS_REVIEW",
          detected,
          error: null,
          usedAnthropicFallback,
          message: hasError
            ? "Document uploaded. Please fill in your passport details manually above."
            : usedAnthropicFallback
              ? "Passport details extracted automatically. Please verify the information is correct."
              : "Document uploaded successfully. Your counsellor will review the document manually.",
        },
      });
    }

    const generic = await scanGenericDoc(payload.fileUrl);
    const verified = !("error" in generic);

    return NextResponse.json({
      data: {
        documentId: document.id,
        ocrStatus: verified ? "VERIFIED" : "NEEDS_REVIEW",
        extractedText: "error" in generic ? "" : generic.extractedText,
        confidence: "error" in generic ? 0 : generic.confidence,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/profile/document-scan POST]", error);
    return NextResponse.json({ error: "Failed to scan document" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const ctx = await getStudent();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = patchSchema.parse(await req.json());

    const document = await db.document.findFirst({
      where: {
        id: payload.documentId,
        studentId: ctx.student.id,
        type: "PASSPORT",
      },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Passport document not found" }, { status: 404 });
    }

    const extended = await readExtended(ctx.student.id);
    const existingPassport =
      extended.passport && typeof extended.passport === "object"
        ? (extended.passport as Record<string, unknown>)
        : {};

    const finalName = payload.correctedName || String(existingPassport.lastOcrName || "");
    const finalNumber = payload.correctedNumber || String(existingPassport.lastOcrNumber || "");
    const finalExpiry = payload.correctedExpiry || String(existingPassport.lastOcrExpiry || "");

    extended.passport = {
      ...existingPassport,
      ocrStatus: payload.confirmed ? "VERIFIED" : "NEEDS_REVIEW",
      lastOcrName: finalName,
      lastOcrNumber: finalNumber,
      lastOcrExpiry: finalExpiry,
      lastDocumentId: document.id,
    };

    if (payload.confirmed) {
      await db.student.update({
        where: { id: ctx.student.id },
        data: {
          passportNumber: finalNumber || null,
          passportExpiry: finalExpiry ? new Date(finalExpiry) : null,
        },
      });
      await db.document.update({
        where: { id: document.id },
        data: { status: "VERIFIED" },
      });
    }

    await db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        entityType: "studentProfile",
        entityId: ctx.student.id,
        action: "upsert",
        details: JSON.stringify(extended),
      },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/profile/document-scan PATCH]", error);
    return NextResponse.json({ error: "Failed to update OCR confirmation" }, { status: 500 });
  }
}
