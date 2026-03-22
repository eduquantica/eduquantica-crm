import { Prisma } from "@prisma/client";

export async function finalizeChecklistIfComplete(
  tx: Prisma.TransactionClient,
  checklistId: string,
  reviewerUserId: string,
) {
  const checklist = await tx.documentChecklist.findUnique({
    where: { id: checklistId },
    include: {
      student: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
        },
      },
      items: {
        select: {
          id: true,
          isRequired: true,
          status: true,
          documentId: true,
        },
      },
    },
  });

  if (!checklist) return { checklistVerified: false };

  const requiredItems = checklist.items.filter((item) => item.isRequired);
  const allRequiredVerified =
    requiredItems.length > 0 &&
    requiredItems.every((item) => item.status === "VERIFIED" && Boolean(item.documentId));

  if (!allRequiredVerified) {
    if (checklist.status === "VERIFIED") {
      await tx.documentChecklist.update({
        where: { id: checklist.id },
        data: {
          status: "UNDER_REVIEW",
          verifiedAt: null,
          verifiedBy: null,
        },
      });
    }
    return { checklistVerified: false };
  }

  if (checklist.status !== "VERIFIED") {
    await tx.documentChecklist.update({
      where: { id: checklist.id },
      data: {
        status: "VERIFIED",
        verifiedBy: reviewerUserId,
        verifiedAt: new Date(),
      },
    });

    if (checklist.student.userId) {
      await tx.notification.create({
        data: {
          userId: checklist.student.userId,
          type: "CHECKLIST_VERIFIED",
          message: "Your document checklist has been fully verified. You can now download your verified certificate.",
          linkUrl: "/student/documents",
        },
      });
    }

    if (checklist.student.assignedCounsellorId) {
      await tx.notification.create({
        data: {
          userId: checklist.student.assignedCounsellorId,
          type: "CHECKLIST_VERIFIED",
          message: `All required documents are verified for ${checklist.student.firstName} ${checklist.student.lastName}.`,
          linkUrl: `/dashboard/students/${checklist.student.id}`,
        },
      });
    }
  }

  return { checklistVerified: true };
}
