import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getNextCounsellor } from "@/lib/counsellor";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    // Check for duplicate email (case-insensitive)
    const existing = await db.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // Lookup STUDENT role
    const role = await db.role.findUnique({
      where: { name: "STUDENT" },
      select: { id: true },
    });

    if (!role) {
      return NextResponse.json(
        { error: "Student role not configured. Please contact support." },
        { status: 500 },
      );
    }

    const hashed = await bcrypt.hash(data.password, 12);

    const referralCookie = req.cookies.get("eq_ref")?.value?.trim();

    let referredSubAgentId: string | null = null;
    if (referralCookie) {
      const referredBy = await db.subAgent.findFirst({
        where: { referralCode: referralCookie },
        select: { id: true },
      });
      referredSubAgentId = referredBy?.id ?? null;
    }

    const counsellor = await getNextCounsellor();

    // Create User + Student in a transaction
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          password: hashed,
          name: `${data.firstName} ${data.lastName}`,
          phone: data.phone ?? null,
          roleId: role.id,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email.toLowerCase(),
          phone: data.phone ?? null,
          nationality: data.nationality ?? null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          assignedCounsellorId: counsellor?.id ?? null,
          subAgentId: referredSubAgentId,
          referredBySubAgentId: referredSubAgentId,
        },
      });

      return { user, student };
    });

    const studentName = `${created.student.firstName} ${created.student.lastName}`.trim();
    const loginUrl = `${process.env.NEXTAUTH_URL || ""}/login`;

    await sendResendEmail({
      to: created.user.email,
      subject: `Welcome to EduQuantica - ${created.student.firstName}!`,
      html: `
        <p>Hi ${created.student.firstName},</p>
        <p>Welcome to EduQuantica. We help you discover courses, track applications, and upload documents in one place.</p>
        <p><a href="${loginUrl}">Log in to your account</a></p>
        <p>Get started in 3 quick steps:</p>
        <ol>
          <li>Complete your onboarding preferences</li>
          <li>Add your qualifications</li>
          <li>Start chatting with Eduvi and your counsellor</li>
        </ol>
      `,
    }).catch(() => undefined);

    if (counsellor?.id) {
      await NotificationService.createNotification({
        userId: counsellor.id,
        type: "STUDENT_REGISTERED",
        message: `New student registered: ${studentName} - ${created.student.nationality || "Unknown"}`,
        linkUrl: `/dashboard/students/${created.student.id}`,
        actorUserId: created.user.id,
      }).catch(() => undefined);
    }

    if (counsellor?.email) {
      await sendResendEmail({
        to: counsellor.email,
        subject: `New student registered: ${studentName}`,
        html: `<p>New student registered: <strong>${studentName}</strong> - ${created.student.nationality || "Unknown"}</p>`,
      }).catch(() => undefined);
    }

    const response = NextResponse.json({ message: "Account created successfully." }, { status: 201 });
    response.cookies.set("eq_ref", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    console.error("[register-student]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
