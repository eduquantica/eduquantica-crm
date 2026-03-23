import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

    const applications = await db.serviceApplication.findMany({
      where: { studentId: student.id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const listingIds = Array.from(new Set(applications.map((item) => item.listingId)));
    const referrals = listingIds.length
      ? await db.serviceReferral.findMany({
          where: {
            studentId: student.id,
            listingId: { in: listingIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            listingId: true,
            referralCode: true,
          },
        })
      : [];

    const referralMap = new Map<string, string>();
    for (const row of referrals) {
      if (!referralMap.has(row.listingId)) {
        referralMap.set(row.listingId, row.referralCode);
      }
    }

    return NextResponse.json({
      data: applications.map((item) => ({
        id: item.id,
        listing: item.listing.title,
        providerType: item.listing.type,
        status: item.status,
        referralCode: referralMap.get(item.listingId) || "-",
        dateApplied: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("[GET /api/student/services/applications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
