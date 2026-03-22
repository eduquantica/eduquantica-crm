import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizeChecklistIfComplete } from "@/lib/checklist-review";

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

type UiStatus = "PENDING_REVIEW" | "VERIFIED" | "REVISION_REQUIRED" | "REJECTED";

function resolveUiStatus(input: {
  itemStatus: string;
  scanDecision: string | null;
  documentStatus: string;
}): UiStatus {
  if (input.scanDecision === "REVISION_REQUIRED") return "REVISION_REQUIRED";
  if (input.itemStatus === "REJECTED" || input.scanDecision === "REJECTED" || input.documentStatus === "REJECTED") {
    return "REJECTED";
  }
  if (input.itemStatus === "VERIFIED" || input.scanDecision === "ACCEPTED" || input.documentStatus === "VERIFIED") {
    return "VERIFIED";
  }
  return "PENDING_REVIEW";
}

const bulkSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !VIEW_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";
    const status = request.nextUrl.searchParams.get("status")?.trim() || "ALL";
    const risk = request.nextUrl.searchParams.get("risk")?.trim() || "ALL";
    const counsellorId = request.nextUrl.searchParams.get("counsellorId")?.trim() || "ALL";

    const items = await db.checklistItem.findMany({
      where: {
        documentId: { not: null },
        ...(session.user.roleName === "COUNSELLOR"
          ? { checklist: { student: { assignedCounsellorId: session.user.id } } }
          : counsellorId !== "ALL"
            ? { checklist: { student: { assignedCounsellorId: counsellorId } } }
            : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        checklist: {
          select: {
            id: true,
            signedPdfUrl: true,
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                assignedCounsellor: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            application: {
              select: {
                id: true,
                course: {
                  select: {
                    name: true,
                    university: { select: { name: true } },
                  },
                },
              },
            },
            items: {
              select: {
                isRequired: true,
                status: true,
                documentId: true,
              },
            },
          },
        },
        document: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            status: true,
            scanResult: {
              select: {
                id: true,
                status: true,
                counsellorDecision: true,
                counsellorNote: true,
                plagiarismScore: true,
                aiScore: true,
                flagColour: true,
                reviewedAt: true,
              },
            },
          },
        },
      },
      take: 300,
    });

    const rows = items
      .map((item) => {
        const uiStatus = resolveUiStatus({
          itemStatus: item.status,
          scanDecision: item.document?.scanResult?.counsellorDecision || null,
          documentStatus: item.document?.status || "PENDING",
        });

        return {
          allChecklistItemsVerified:
            item.checklist.items.filter((checklistItem) => checklistItem.isRequired).length > 0
            && item.checklist.items
              .filter((checklistItem) => checklistItem.isRequired)
              .every((checklistItem) => checklistItem.status === "VERIFIED" && Boolean(checklistItem.documentId)),
          certificateAlreadyGenerated: Boolean(item.checklist.signedPdfUrl),
          id: item.id,
          checklistId: item.checklistId,
          label: item.label,
          documentType: item.documentType,
          studentId: item.checklist.student.id,
          studentName: `${item.checklist.student.firstName} ${item.checklist.student.lastName}`.trim(),
          counsellorId: item.checklist.student.assignedCounsellor?.id || null,
          counsellorName: item.checklist.student.assignedCounsellor?.name || item.checklist.student.assignedCounsellor?.email || "Unassigned",
          applicationId: item.checklist.application?.id || null,
          universityName: item.checklist.application?.course.university.name || "-",
          courseName: item.checklist.application?.course.name || "-",
          status: uiStatus,
          riskLevel: item.fraudRiskLevel,
          ocrConfidence: item.ocrConfidence,
          fraudFlags: item.fraudFlags,
          uploadedAt: item.document?.id ? item.createdAt.toISOString() : null,
          reviewedAt: item.document?.scanResult?.reviewedAt?.toISOString() || null,
          fileName: item.document?.fileName || null,
          fileUrl: item.document?.fileUrl || null,
          scan: item.document?.scanResult
            ? {
                plagiarismScore: item.document.scanResult.plagiarismScore,
                aiScore: item.document.scanResult.aiScore,
                flagColour: item.document.scanResult.flagColour,
                decision: item.document.scanResult.counsellorDecision,
              }
            : null,
        };
      })
      .filter((row) => {
        if (status !== "ALL" && row.status !== status) return false;
        if (risk !== "ALL" && row.riskLevel !== risk) return false;
        if (!search) return true;
        return (
          row.studentName.toLowerCase().includes(search) ||
          row.label.toLowerCase().includes(search) ||
          row.universityName.toLowerCase().includes(search) ||
          row.courseName.toLowerCase().includes(search)
        );
      });

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("[/api/admin/document-verification GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bulkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const itemIds = Array.from(new Set(parsed.data.itemIds));

    const updatedCount = await db.$transaction(async (tx) => {
      const items = await tx.checklistItem.findMany({
        where: {
          id: { in: itemIds },
          documentId: { not: null },
        },
        include: {
          document: true,
        },
      });

      if (items.length === 0) return 0;

      const checklistIds = new Set<string>();

      for (const item of items) {
        if (item.documentId) {
          await tx.document.update({
            where: { id: item.documentId },
            data: { status: "VERIFIED" },
          });

          await tx.documentScanResult.upsert({
            where: { documentId: item.documentId },
            update: {
              counsellorDecision: "ACCEPTED",
              counsellorNote: null,
              reviewedBy: session.user.id,
              reviewedAt: new Date(),
            },
            create: {
              documentId: item.documentId,
              status: "PENDING",
              counsellorDecision: "ACCEPTED",
              reviewedBy: session.user.id,
              reviewedAt: new Date(),
            },
          });
        }

        await tx.checklistItem.update({
          where: { id: item.id },
          data: {
            status: "VERIFIED",
            counsellorNote: null,
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.user.id,
            entityType: "checklist-item",
            entityId: item.id,
            action: "checklist_item_bulk_verified",
            details: `Bulk verified item ${item.label}`,
          },
        });

        checklistIds.add(item.checklistId);
      }

      for (const checklistId of Array.from(checklistIds)) {
        await finalizeChecklistIfComplete(tx, checklistId, session.user.id);
      }

      return items.length;
    });

    return NextResponse.json({ data: { updatedCount } });
  } catch (error) {
    console.error("[/api/admin/document-verification POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
