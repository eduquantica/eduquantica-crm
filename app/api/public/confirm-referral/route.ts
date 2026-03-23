import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { referralCode?: string };
    const code = (body.referralCode || "").trim().toUpperCase();

    if (!code || code.length !== 8) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
    }

    const referral = await db.serviceReferral.findUnique({
      where: { referralCode: code },
      include: {
        student: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            assignedCounsellorId: true,
          },
        },
        provider: {
          select: { id: true, name: true },
        },
        listing: {
          select: { id: true, title: true },
        },
      },
    });

    if (!referral) {
      return NextResponse.json({ error: "Referral code not found" }, { status: 404 });
    }

    if (referral.providerConfirmed) {
      return NextResponse.json({
        data: {
          referralCode: referral.referralCode,
          alreadyConfirmed: true,
          providerConfirmedAt: referral.providerConfirmedAt,
          providerName: referral.provider.name,
          listingTitle: referral.listing.title,
        },
      });
    }

    const now = new Date();
    await db.serviceReferral.update({
      where: { id: referral.id },
      data: {
        providerConfirmed: true,
        providerConfirmedAt: now,
        status: referral.status === "SENT" || referral.status === "CLICKED" ? "ENQUIRED" : referral.status,
      },
    });

    const adminUsers = await db.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "MANAGER"] } },
      },
      select: { id: true },
    });

    const studentName = `${referral.student.firstName} ${referral.student.lastName}`.trim();
    const notifyUserIds = Array.from(
      new Set(
        [
          referral.student.userId,
          referral.student.assignedCounsellorId,
          ...adminUsers.map((u) => u.id),
        ].filter((v): v is string => Boolean(v)),
      ),
    );

    await Promise.all(
      notifyUserIds.map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "SERVICE_REFERRAL_PROVIDER_CONFIRMED",
          message: `Provider ${referral.provider.name} confirmed referral ${code} for student ${studentName}.`,
          linkUrl: "/dashboard/student-services",
        }).catch(() => undefined),
      ),
    );

    return NextResponse.json({
      data: {
        referralCode: code,
        alreadyConfirmed: false,
        providerName: referral.provider.name,
        listingTitle: referral.listing.title,
        studentName,
      },
    });
  } catch (error) {
    console.error("[POST /api/public/confirm-referral]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
