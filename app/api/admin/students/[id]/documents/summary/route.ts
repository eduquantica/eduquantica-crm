import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const allowedRoles = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"]);
    if (!allowedRoles.has(session.user.roleName)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studentId = params.id;

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        assignedCounsellorId: true,
        subAgentStaffId: true,
        subAgent: { select: { userId: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      session.user.roleName === "SUB_AGENT"
      && student.subAgent?.userId !== session.user.id
      && student.subAgentStaffId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      session.user.roleName === "SUB_AGENT_COUNSELLOR"
      && student.subAgent?.userId !== session.user.id
      && student.subAgentStaffId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      pendingUpload,
      uploadedScanning,
      needsRevision,
      verified,
      flaggedHigh,
      totalRequested,
    ] = await Promise.all([
      db.documentRequest.count({
        where: {
          studentId,
          status: "PENDING",
        },
      }),
      db.documentRequest.count({
        where: {
          studentId,
          uploadedFileUrl: { not: null },
          verificationStatus: "PENDING",
        },
      }),
      db.documentRequest.count({
        where: {
          studentId,
          verificationStatus: "NEEDS_REVISION",
        },
      }),
      db.documentRequest.count({
        where: {
          studentId,
          verificationStatus: "VERIFIED",
        },
      }),
      db.document.count({
        where: {
          studentId,
          OR: [
            { flagColour: "RED" },
            { scanResult: { flagColour: "RED" } },
            { checklistItems: { some: { fraudRiskLevel: "HIGH" } } },
          ],
        },
      }),
      db.documentRequest.count({
        where: {
          studentId,
        },
      }),
    ]);

    // Backward-compatible readiness signal used by existing UI.
    const allReady = totalRequested > 0 && pendingUpload === 0 && uploadedScanning === 0 && needsRevision === 0;

    // Keep existing activity notification behavior when everything is ready.
    if (allReady) {
      const existing = await db.activityLog.findFirst({ where: { entityType: "student", entityId: studentId, action: "documents ready to submit" } });
      if (!existing) {
        const toNotify: string[] = [];
        if (student.assignedCounsellorId) toNotify.push(student.assignedCounsellorId);
        if (student.subAgent?.userId) toNotify.push(student.subAgent.userId);

        const creatorLog = await db.activityLog.findFirst({ where: { entityType: "student", entityId: studentId, action: "created student" } });
        if (creatorLog) {
          const creator = await db.user.findUnique({ where: { id: creatorLog.userId }, include: { role: true } });
          if (creator && creator.role && ["ADMIN", "MANAGER", "COUNSELLOR"].includes(creator.role.name)) {
            toNotify.push(creator.id);
          }
        }

        const uniq = Array.from(new Set(toNotify));
        for (const uid of uniq) {
          try {
            await db.activityLog.create({
              data: {
                userId: uid,
                entityType: "student",
                entityId: studentId,
                action: "documents ready to submit",
                details: `All required documents verified for student ${studentId}`,
              },
            });
          } catch (err) {
            console.error("Failed to create notification activity log", err);
          }
        }
      }
    }

    const latestChecklist = await db.documentChecklist.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        signedPdfUrl: true,
        verificationRef: true,
        items: {
          select: {
            isRequired: true,
            status: true,
            documentId: true,
          },
        },
      },
    });

    const requiredItems = latestChecklist?.items.filter((item) => item.isRequired) || [];
    const allChecklistItemsVerified =
      requiredItems.length > 0
      && requiredItems.every((item) => item.status === "VERIFIED" && Boolean(item.documentId));

    return NextResponse.json({
      data: {
        pendingUpload,
        uploadedScanning,
        needsRevision,
        verified,
        flaggedHigh,
        allReady,
        checklistId: latestChecklist?.id || null,
        allChecklistItemsVerified,
        certificateAlreadyGenerated: Boolean(latestChecklist?.signedPdfUrl),
        verificationRef: latestChecklist?.verificationRef || null,
      },
    });
  } catch (error) {
    console.error("[/api/admin/students/[id]/documents/summary GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


