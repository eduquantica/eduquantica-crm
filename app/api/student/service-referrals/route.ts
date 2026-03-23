import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

const updateSchema = z.object({
  referralId: z.string().min(1),
  confirmed: z.boolean(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const referrals = await db.serviceReferral.findMany({
      where: { studentId: student.id },
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: referrals.map((row) => ({
        id: row.id,
        referralCode: row.referralCode,
        status: row.status,
        studentConfirmed: row.studentConfirmed,
        studentConfirmedAt: row.studentConfirmedAt,
        followUpCount: row.followUpCount,
        followUpSentAt: row.followUpSentAt,
        createdAt: row.createdAt,
        listing: row.listing,
        provider: row.provider,
      })),
    });
  } catch (error) {
    console.error("[GET /api/student/service-referrals]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        userId: true,
        assignedCounsellorId: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const existing = await db.serviceReferral.findFirst({
      where: {
        id: parsed.data.referralId,
        studentId: student.id,
      },
      include: {
        provider: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    const now = new Date();
    const updated = await db.serviceReferral.update({
      where: { id: existing.id },
      data: parsed.data.confirmed
        ? {
            studentConfirmed: true,
            studentConfirmedAt: now,
            status: existing.status === "SENT" || existing.status === "CLICKED" ? "ENQUIRED" : existing.status,
          }
        : {
            studentConfirmed: false,
            studentConfirmedAt: null,
            status: "REJECTED",
            placementConfirmed: false,
            placementDate: null,
          },
    });

    const adminUsers = await db.user.findMany({
      where: {
        role: {
          name: { in: ["ADMIN", "MANAGER"] },
        },
      },
      select: { id: true },
    });

    const notifyUserIds = Array.from(
      new Set([
        ...adminUsers.map((user) => user.id),
        student.assignedCounsellorId,
      ].filter((value): value is string => Boolean(value))),
    );

    await Promise.all(
      notifyUserIds.map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "SERVICE_REFERRAL_STUDENT_CONFIRMATION",
          message: parsed.data.confirmed
            ? `Student confirmed referral ${existing.referralCode} with provider ${existing.provider.name}.`
            : `Student marked referral ${existing.referralCode} as not contacted by provider ${existing.provider.name}.`,
          linkUrl: "/dashboard/student-services",
          actorUserId: session.user.id,
        }).catch(() => undefined),
      ),
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PATCH /api/student/service-referrals]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
