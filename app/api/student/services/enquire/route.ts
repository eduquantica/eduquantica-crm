import { randomBytes } from "crypto";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";
import { sendResendEmail } from "@/lib/resend";

const enquirySchema = z.object({
  listingId: z.string().min(1),
  studentNote: z.string().trim().optional().default(""),
  studentId: z.string().trim().optional(),
  referralCode: z.string().trim().length(8).optional(),
});

function canAccess(roleName?: string) {
  return Boolean(roleName);
}

async function generateReferralCode() {
  for (let index = 0; index < 10; index += 1) {
    const code = randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
    const existing = await db.serviceReferral.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique referral code");
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccess(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = enquirySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const student = session.user.roleName === "STUDENT"
      ? await db.student.findUnique({
          where: { userId: session.user.id },
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
            assignedCounsellorId: true,
          },
        })
      : parsed.data.studentId
        ? await db.student.findUnique({
            where: { id: parsed.data.studentId },
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              assignedCounsellorId: true,
            },
          })
        : null;

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const listing = await db.serviceListing.findFirst({
      where: { id: parsed.data.listingId, isActive: true },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    let referralCode = (parsed.data.referralCode || "").toUpperCase();
    if (referralCode) {
      const existingCode = await db.serviceReferral.findUnique({ where: { referralCode } });
      if (existingCode) {
        referralCode = await generateReferralCode();
      }
    } else {
      referralCode = await generateReferralCode();
    }
    const studentName = `${student.firstName} ${student.lastName}`.trim();

    const { application, referral } = await db.$transaction(async (tx) => {
      const application = await tx.serviceApplication.create({
        data: {
          studentId: student.id,
          listingId: listing.id,
          studentNote: parsed.data.studentNote || null,
        },
      });

      const referral = await tx.serviceReferral.create({
        data: {
          referralCode,
          studentId: student.id,
          listingId: listing.id,
          providerId: listing.providerId,
        },
      });

      return { application, referral };
    });

    const adminUsers = await db.user.findMany({
      where: {
        role: {
          name: { in: ["ADMIN", "MANAGER"] },
        },
      },
      select: { id: true },
    });

    const notifyUserIds = Array.from(new Set([
      ...adminUsers.map((user) => user.id),
      student.assignedCounsellorId || "",
    ].filter(Boolean)));

    await Promise.all([
      sendResendEmail({
        to: student.email,
        subject: "Your EduQuantica Referral Code",
        html: `<p>Dear ${studentName},</p><p>Your enquiry for ${listing.title} has been submitted.</p><p>Your referral code is: ${referralCode}</p><p>Our team will contact you within 24 hours to facilitate your enquiry.</p><p>Please quote code ${referralCode} in all communications with the provider.</p>`,
      }).catch(() => undefined),
      ...(listing.provider.contactEmail || listing.provider.email
        ? [sendResendEmail({
            to: listing.provider.contactEmail || listing.provider.email || "",
            subject: `New Student Referral - ${referralCode}`,
            html: `<p>Dear ${listing.provider.name},</p><p>A student has enquired about ${listing.title} through EduQuantica.</p><p>Referral Code: ${referralCode}</p><p>Please quote this code when reporting this placement to EduQuantica for commission purposes.</p>`,
          }).catch(() => undefined)]
        : []),
      ...notifyUserIds.map((userId) =>
        NotificationService.createNotification({
          userId,
          type: "SERVICE_ENQUIRY_CREATED",
          message: `New referral ${referralCode} created for ${studentName} - ${listing.title}`,
          linkUrl: `/dashboard/student-services`,
          actorUserId: session.user.id,
        }).catch(() => undefined),
      ),
    ]);

    return NextResponse.json({
      data: {
        id: application.id,
        referralId: referral.id,
        referralCode,
        listingId: listing.id,
        listingTitle: listing.title,
        providerType: listing.type,
        status: application.status,
        dateApplied: application.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/student/services/enquire]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}