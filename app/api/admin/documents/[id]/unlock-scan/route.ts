import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  reason: z.string().trim().min(3, "Reason is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const scan = await db.documentScanResult.findUnique({
      where: { documentId: params.id },
      include: { document: { select: { type: true, studentId: true } } },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan result not found for document" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.documentScanResult.update({
        where: { id: scan.id },
        data: { isLocked: false },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "document",
          entityId: params.id,
          action: "scan_unlock_for_rescan",
          details: `Scan unlocked for ${scan.document.type} (student ${scan.document.studentId}). Reason: ${parsed.data.reason}. Timestamp: ${new Date().toISOString()}`,
        },
      });
    });

    return NextResponse.json({ data: { unlocked: true } });
  } catch (error) {
    console.error("[/api/admin/documents/[id]/unlock-scan POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
