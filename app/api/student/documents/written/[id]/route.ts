import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { countWords } from "@/lib/written-documents";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  manualSave: z.boolean().optional(),
  restoreVersionId: z.string().optional(),
});

async function getOwnedDocument(userId: string, id: string) {
  return db.studentDocument.findFirst({
    where: {
      id,
      student: { userId },
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
      versions: {
        orderBy: { savedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ data: document });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const payload = updateSchema.parse(await req.json());
    const document = await getOwnedDocument(session.user.id, params.id);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (payload.restoreVersionId) {
      const targetVersion = await db.studentDocumentVersion.findFirst({
        where: {
          id: payload.restoreVersionId,
          documentId: document.id,
        },
      });

      if (!targetVersion) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }

      const nextVersion = document.version + 1;
      const restored = await db.$transaction(async (tx) => {
        await tx.studentDocumentVersion.create({
          data: {
            documentId: document.id,
            version: nextVersion,
            content: document.content,
            savedBy: session.user.id,
          },
        });

        return tx.studentDocument.update({
          where: { id: document.id },
          data: {
            content: targetVersion.content,
            wordCount: countWords(targetVersion.content),
            version: nextVersion,
          },
        });
      });

      return NextResponse.json({ data: restored, message: "Version restored successfully" });
    }

    const nextTitle = payload.title?.trim() ?? document.title;
    const nextContent = payload.content ?? document.content;

    if (payload.manualSave) {
      const nextVersion = document.version + 1;
      const updated = await db.$transaction(async (tx) => {
        await tx.studentDocumentVersion.create({
          data: {
            documentId: document.id,
            version: nextVersion,
            content: nextContent,
            savedBy: session.user.id,
          },
        });

        return tx.studentDocument.update({
          where: { id: document.id },
          data: {
            title: nextTitle,
            content: nextContent,
            wordCount: countWords(nextContent),
            version: nextVersion,
          },
        });
      });

      return NextResponse.json({ data: updated });
    }

    const updated = await db.studentDocument.update({
      where: { id: document.id },
      data: {
        title: nextTitle,
        content: nextContent,
        wordCount: countWords(nextContent),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/documents/written/[id] PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const document = await getOwnedDocument(session.user.id, params.id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await db.studentDocument.update({
    where: { id: document.id },
    data: {
      scanStatus: "DELETED",
    },
  });

  return NextResponse.json({ data: { ok: true } });
}
