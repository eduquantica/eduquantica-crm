import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeUploadByUrl } from "@/lib/local-upload";

async function canDeleteDocument(userId: string, roleName: string | undefined, student: {
  userId: string;
  assignedCounsellorId: string | null;
  subAgentId: string | null;
  subAgentStaffId: string | null;
}) {
  if (!roleName) return false;

  if (roleName === "ADMIN" || roleName === "MANAGER") return true;
  if (roleName === "STUDENT") return student.userId === userId;
  if (roleName === "COUNSELLOR") return student.assignedCounsellorId === userId;

  if (roleName === "SUB_AGENT") {
    if (student.subAgentStaffId) {
      const staff = await db.subAgentStaff.findUnique({
        where: { userId },
        select: { id: true, subAgentId: true },
      });
      if (staff && staff.id === student.subAgentStaffId) return true;
    }

    const subAgent = await db.subAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
    return Boolean(subAgent && subAgent.id === student.subAgentId);
  }

  return false;
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await db.document.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileUrl: true,
        student: {
          select: {
            userId: true,
            assignedCounsellorId: true,
            subAgentId: true,
            subAgentStaffId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const allowed = await canDeleteDocument(session.user.id, session.user.roleName, document.student);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.$transaction(async (tx) => {
      await tx.checklistItem.updateMany({
        where: { documentId: document.id },
        data: {
          documentId: null,
          status: "PENDING",
        },
      });

      await tx.studentQualification.updateMany({
        where: { transcriptDocId: document.id },
        data: { transcriptDocId: null },
      });

      await tx.documentScanResult.deleteMany({ where: { documentId: document.id } });
      await tx.document.delete({ where: { id: document.id } });
    });

    if (document.fileUrl) {
      await removeUploadByUrl(document.fileUrl);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/documents/[id] DELETE]", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
