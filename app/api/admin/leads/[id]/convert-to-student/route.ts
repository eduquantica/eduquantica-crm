import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { randomBytes } from "crypto";
import { generateStudentNumber } from "@/lib/generateIds";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    // Only Admin and Manager can convert
    if (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const leadId = params.id;

    const lead = await db.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json(
        { error: "Lead must have an email address to convert" },
        { status: 400 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await db.user.findUnique({
      where: { email: lead.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Get STUDENT role
    const studentRole = await db.role.findUnique({
      where: { name: "STUDENT" },
    });

    if (!studentRole) {
      return NextResponse.json(
        { error: "STUDENT role not found" },
        { status: 500 }
      );
    }

    // Create User record
    const newUser = await db.user.create({
      data: {
        email: lead.email.toLowerCase(),
        name: `${lead.firstName} ${lead.lastName}`,
        roleId: studentRole.id,
        phone: lead.phone || null,
      },
    });

    // Create Student record
    // shape matches unchecked create input; avoid strict typing to sidestep
    // StudentCreateInput requirements (it prefers nested user relation).
    const studentNumber = await generateStudentNumber();
    const newStudent = await db.student.create({
      data: {
        userId: newUser.id,
        studentNumber,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email.toLowerCase(),
        phone: lead.phone || null,
        nationality: lead.nationality || null,
        assignedCounsellorId: lead.assignedCounsellorId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // Generate password reset token for welcome email (48 hours valid)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.passwordResetToken.create({
      data: {
        userId: newUser.id,
        token,
        expiresAt,
      },
    });

    // Send welcome email
    const setPasswordUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    try {
      await sendMail({
        to: lead.email,
        subject: "Welcome to EduQuantica — Set Your Password",
        text: `Welcome to EduQuantica, ${lead.firstName}!\n\nYour student profile has been created successfully. To get started, please set your password by visiting:\n\n${setPasswordUrl}\n\nThis link will expire in 48 hours.\n\nIf you didn't request this, please ignore this email.`,
        html: `
          <h2>Welcome to EduQuantica, ${lead.firstName}!</h2>
          <p>Your student profile has been created successfully. To get started, please set your password by clicking the link below:</p>
          <p><a href="${setPasswordUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Set Your Password</a></p>
          <p>This link will expire in 48 hours.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });
    } catch (err) {
      console.error("Failed to send welcome email:", err);
      // Don't fail the conversion if email fails
    }

    // Update lead status and link to student
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        status: "CONVERTED",
      },
      include: {
        assignedCounsellor: { select: { id: true, name: true } },
        subAgent: { select: { id: true, agencyName: true } },
      },
    });

    // Log the conversion
    await db.communication.create({
      data: {
        leadId,
        userId: session.user.id,
        type: "NOTE",
        message: `Lead converted to student (ID: ${newStudent.id})`,
        direction: "OUTBOUND",
      },
    });

    return NextResponse.json(
      { data: { student: newStudent, user: newUser, lead: updatedLead } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[/api/admin/leads/[id]/convert-to-student POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
