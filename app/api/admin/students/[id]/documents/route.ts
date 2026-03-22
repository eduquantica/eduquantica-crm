import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

const uploadSchema = z.object({
  type: z.enum([
    "PASSPORT",
    "TRANSCRIPT",
    "DEGREE_CERT",
    "ENGLISH_TEST",
    "SOP",
    "LOR",
    "CV",
    "FINANCIAL_PROOF",
    "PHOTO",
    "VISA_DOCUMENT",
    "PERSONAL_STATEMENT",
    "COVER_LETTER",
    "OTHER",
  ]),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { id: params.id },
      select: { id: true, assignedCounsellorId: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await db.document.findMany({
      where: { studentId: student.id },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileUrl: true,
        status: true,
        uploadedAt: true,
        uploadedAfterApproval: true,
        scanResult: {
          select: {
            id: true,
            status: true,
            scanId: true,
            plagiarismScore: true,
            aiScore: true,
            flagColour: true,
            counsellorDecision: true,
            counsellorNote: true,
            reportUrl: true,
            isLocked: true,
            scannedAt: true,
            reviewedAt: true,
          },
        },
      },
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error("[/api/admin/students/[id]/documents GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { id: params.id },
      select: { id: true, assignedCounsellorId: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = uploadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const payload = parsed.data;

    const document = await db.document.create({
      data: {
        studentId: student.id,
        type: payload.type,
        fileName: payload.fileName,
        fileUrl: payload.fileUrl,
        status: "PENDING",
      },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileUrl: true,
        status: true,
        uploadedAt: true,
        uploadedAfterApproval: true,
        scanResult: {
          select: {
            id: true,
            status: true,
            scanId: true,
            plagiarismScore: true,
            aiScore: true,
            flagColour: true,
            counsellorDecision: true,
            counsellorNote: true,
            reportUrl: true,
            isLocked: true,
            scannedAt: true,
            reviewedAt: true,
          },
        },
      },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "document",
        entityId: document.id,
        action: "uploaded_by_admin",
        details: payload.notes?.trim()
          ? `${payload.type}: ${payload.notes.trim()}`
          : payload.type,
      },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error("[/api/admin/students/[id]/documents POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
