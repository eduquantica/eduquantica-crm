import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checklist = await db.documentChecklist.findUnique({
      where: { applicationId: params.id },
      select: {
        id: true,
        signedPdfUrl: true,
        verificationRef: true,
        student: { select: { assignedCounsellorId: true } },
        items: {
          select: {
            isRequired: true,
            status: true,
            documentId: true,
          },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json({
        data: {
          checklistId: null,
          allVerified: false,
          signedPdfUrl: null,
          verificationRef: null,
        },
      });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      checklist.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requiredItems = checklist.items.filter((item) => item.isRequired);
    const allVerified =
      requiredItems.length > 0 &&
      requiredItems.every((item) => item.status === "VERIFIED" && Boolean(item.documentId));

    return NextResponse.json({
      data: {
        checklistId: checklist.id,
        allVerified,
        signedPdfUrl: checklist.signedPdfUrl,
        verificationRef: checklist.verificationRef,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/checklist-certificate GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
