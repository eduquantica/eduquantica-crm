import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = uploadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true, assignedCounsellorId: true, subAgent: { select: { userId: true } } },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const request = await db.documentRequest.findFirst({
    where: { id: params.id, studentId: student.id },
    select: { id: true, documentLabel: true },
  });

  if (!request) {
    return NextResponse.json({ error: "Document request not found" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        studentId: student.id,
        type: "OTHER",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    return tx.documentRequest.update({
      where: { id: request.id },
      data: {
        status: "UPLOADED",
        verificationStatus: "PENDING",
        uploadedFileName: parsed.data.fileName,
        uploadedFileUrl: parsed.data.fileUrl,
        uploadedAt: new Date(),
        uploadedDocumentId: document.id,
      },
    });
  });

  const studentName = `${student.firstName} ${student.lastName}`.trim();

  const notifyUserIds = new Set<string>();
  if (student.assignedCounsellorId) notifyUserIds.add(student.assignedCounsellorId);
  if (student.subAgent?.userId) notifyUserIds.add(student.subAgent.userId);

  const adminAndManagers = await db.user.findMany({
    where: { role: { name: { in: ["ADMIN", "MANAGER"] } } },
    select: { id: true },
    take: 20,
  });
  for (const row of adminAndManagers) notifyUserIds.add(row.id);

  for (const userId of Array.from(notifyUserIds)) {
    await NotificationService.createNotification({
      userId,
      type: "DOCUMENT_UPLOADED",
      message: `${studentName} uploaded ${request.documentLabel}. Please review it.`,
      linkUrl: `/dashboard/students/${student.id}`,
      actorUserId: session.user.id,
    }).catch(() => undefined);
  }

  return NextResponse.json({ data: updated }, { status: 201 });
}
