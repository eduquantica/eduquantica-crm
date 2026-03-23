import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ReferralStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const updateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["CHASE", "UPDATE"]).optional(),
  status: z.nativeEnum(ReferralStatus).optional(),
  studentConfirmed: z.boolean().optional(),
  providerConfirmed: z.boolean().optional(),
  adminNote: z.string().trim().optional().nullable(),
  commissionDue: z.number().nonnegative().optional().nullable(),
});

function canRead(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function toSummary(rows: { status: ReferralStatus }[]) {
  return {
    total: rows.length,
    sent: rows.filter((row) => row.status === "SENT").length,
    clicked: rows.filter((row) => row.status === "CLICKED").length,
    enquired: rows.filter((row) => row.status === "ENQUIRED").length,
    shortlisted: rows.filter((row) => row.status === "SHORTLISTED").length,
    placed: rows.filter((row) => row.status === "PLACED").length,
    rejected: rows.filter((row) => row.status === "REJECTED").length,
    expired: rows.filter((row) => row.status === "EXPIRED").length,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canRead(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || "";
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";

    const rows = await db.serviceReferral.findMany({
      where: {
        ...(status && Object.values(ReferralStatus).includes(status as ReferralStatus)
          ? { status: status as ReferralStatus }
          : {}),
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            country: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            assignedCounsellorId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = rows.filter((row) => {
      if (!search) return true;
      const studentName = `${row.student.firstName} ${row.student.lastName}`.toLowerCase();
      const haystack = [
        row.referralCode.toLowerCase(),
        studentName,
        (row.student.email || "").toLowerCase(),
        row.listing.title.toLowerCase(),
        row.provider.name.toLowerCase(),
      ].join(" ");
      return haystack.includes(search);
    });

    return NextResponse.json({
      data: filtered.map((row) => ({
        id: row.id,
        referralCode: row.referralCode,
        status: row.status,
        followUpCount: row.followUpCount,
        followUpSentAt: row.followUpSentAt,
        clickedAt: row.clickedAt,
        studentConfirmed: row.studentConfirmed,
        studentConfirmedAt: row.studentConfirmedAt,
        providerConfirmed: row.providerConfirmed,
        providerConfirmedAt: row.providerConfirmedAt,
        placementConfirmed: row.placementConfirmed,
        placementDate: row.placementDate,
        commissionDue: row.commissionDue,
        commissionStatus: row.commissionStatus,
        createdAt: row.createdAt,
        adminNote: row.adminNote,
        student: {
          id: row.student.id,
          name: `${row.student.firstName} ${row.student.lastName}`.trim(),
          email: row.student.email,
          assignedCounsellorId: row.student.assignedCounsellorId,
        },
        listing: row.listing,
        provider: row.provider,
      })),
      summary: toSummary(filtered),
    });
  } catch (error) {
    console.error("[GET /api/admin/service-referrals]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const existing = await db.serviceReferral.findUnique({
      where: { id: parsed.data.id },
      include: {
        student: {
          select: {
            userId: true,
            assignedCounsellorId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    const now = new Date();
    const action = parsed.data.action || "UPDATE";

    const updated = await db.serviceReferral.update({
      where: { id: parsed.data.id },
      data:
        action === "CHASE"
          ? {
              followUpCount: { increment: 1 },
              followUpSentAt: now,
            }
          : {
              ...(parsed.data.status ? { status: parsed.data.status } : {}),
              ...(parsed.data.status === "CLICKED" && !existing.clickedAt ? { clickedAt: now } : {}),
              ...(parsed.data.status === "PLACED"
                ? {
                    placementConfirmed: true,
                    placementDate: now,
                  }
                : {}),
              ...(parsed.data.status === "REJECTED"
                ? {
                    placementConfirmed: false,
                    placementDate: null,
                  }
                : {}),
              ...(parsed.data.studentConfirmed !== undefined
                ? {
                    studentConfirmed: parsed.data.studentConfirmed,
                    studentConfirmedAt: parsed.data.studentConfirmed ? now : null,
                  }
                : {}),
              ...(parsed.data.providerConfirmed !== undefined
                ? {
                    providerConfirmed: parsed.data.providerConfirmed,
                    providerConfirmedAt: parsed.data.providerConfirmed ? now : null,
                  }
                : {}),
              ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote } : {}),
              ...(parsed.data.commissionDue !== undefined ? { commissionDue: parsed.data.commissionDue } : {}),
            },
    });

    const studentName = `${existing.student.firstName} ${existing.student.lastName}`.trim();
    const notifyUserIds = [existing.student.userId, existing.student.assignedCounsellorId]
      .filter((value): value is string => Boolean(value));

    if (action === "CHASE") {
      await Promise.all(
        notifyUserIds.map((userId) =>
          NotificationService.createNotification({
            userId,
            type: "SERVICE_REFERRAL_CHASED",
            message: `Referral ${existing.referralCode} has been followed up by admin team.`,
            linkUrl: "/student/services",
            actorUserId: session.user.id,
          }).catch(() => undefined),
        ),
      );
    }

    if (parsed.data.status === "PLACED" || parsed.data.status === "REJECTED") {
      await Promise.all(
        notifyUserIds.map((userId) =>
          NotificationService.createNotification({
            userId,
            type: "SERVICE_REFERRAL_STATUS_CHANGED",
            message: `Referral ${existing.referralCode} for ${studentName} is now ${parsed.data.status}.`,
            linkUrl: "/student/services",
            actorUserId: session.user.id,
          }).catch(() => undefined),
        ),
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/service-referrals]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
