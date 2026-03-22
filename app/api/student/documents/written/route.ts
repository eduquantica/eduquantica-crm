import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { countWords } from "@/lib/written-documents";

const createSchema = z.object({
  documentType: z.enum(["SOP", "PERSONAL_STATEMENT"]),
  title: z.string().min(1),
  content: z.string().default(""),
  applicationId: z.string().optional().nullable(),
});

async function getStudentBySessionUser(userId: string) {
  return db.student.findUnique({
    where: { userId },
    select: { id: true },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await getStudentBySessionUser(session.user.id);
  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  try {
    const payload = createSchema.parse(await req.json());

    const document = await db.studentDocument.create({
      data: {
        studentId: student.id,
        applicationId: payload.applicationId || null,
        documentType: payload.documentType,
        title: payload.title.trim(),
        content: payload.content,
        wordCount: countWords(payload.content),
      },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/documents/written POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const student = await getStudentBySessionUser(session.user.id);
    if (!student) {
      return NextResponse.json({ error: "Not a student" }, { status: 404 });
    }

    const documents = await db.studentDocument.findMany({
      where: {
        studentId: student.id,
        OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        documentType: true,
        title: true,
        wordCount: true,
        version: true,
        status: true,
        grammarScore: true,
        plagiarismScore: true,
        aiContentScore: true,
        scanStatus: true,
        convertedPdfUrl: true,
        updatedAt: true,
        applicationId: true,
      },
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error("[/api/student/documents/written GET]", error);
    return NextResponse.json({ error: "Failed to load documents", data: [] }, { status: 500 });
  }
}
