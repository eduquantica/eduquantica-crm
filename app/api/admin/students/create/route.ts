import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendMail } from "@/lib/email";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { StudyGapCalculator } from "@/lib/study-gap";
import { generateStudentNumber } from "@/lib/generateIds";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const {
    firstName,
    lastName,
    email,
    phone,
    nationality,
    countryOfResidence,
    assignedCounsellorId,
    subAgentId,
  } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  // get STUDENT role
  const studentRole = await db.role.findUnique({ where: { name: "STUDENT" } });
  if (!studentRole) {
    return NextResponse.json({ error: "STUDENT role not found" }, { status: 500 });
  }

  const newUser = await db.user.create({
    data: {
      email,
      name: `${firstName || ""} ${lastName || ""}`.trim(),
      roleId: studentRole.id,
      isActive: true,
    },
  });

  const studentNumber = await generateStudentNumber();
  // use any for the payload to avoid mismatches with the strict generated type
  // (which expects nested relation create for user rather than userId).
  const newStudent = await db.student.create({
    data: {
      userId: newUser.id,
      studentNumber,
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      phone: phone || null,
      nationality: nationality || null,
      address: countryOfResidence || null,
      assignedCounsellorId: assignedCounsellorId || null,
      subAgentId: subAgentId || null,
      // additional optional profile fields if provided in request
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      passportNumber: body.passportNumber || null,
      passportExpiry: body.passportExpiry ? new Date(body.passportExpiry) : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  // record activity log for creator (helps notify later if needed)
  try {
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "student",
        entityId: newStudent.id,
        action: "created student",
        details: `Student ${newStudent.id} created by ${session.user.id}`,
      },
    });
  } catch (err) {
    // non-fatal
    console.error("Failed to write activity log for student creation", err);
  }

  // compute profile completion for new student
  const profileCompletion = await calculateProfileCompletion(newStudent.id).catch(() => 0);
  await StudyGapCalculator.recalculateAndHandleAlerts(newStudent.id).catch(() => undefined);

  // send password set email
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await db.passwordResetToken.create({
    data: { token, userId: newUser.id, expiresAt },
  });

  const setPasswordUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  try {
    await sendMail({
      to: email,
      subject: "Welcome to EduQuantica — Set Your Password",
      text: `Welcome to EduQuantica, ${firstName || ""}!\n\nYour student account has been created. Set your password:\n\n${setPasswordUrl}\n\nThis link expires in 48 hours.`,
      html: `
        <h2>Welcome to EduQuantica, ${firstName || ""}!</h2>
        <p>Your student account has been created. To get started, set your password by clicking below:</p>
        <p><a href="${setPasswordUrl}" style="background-color:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Set Password</a></p>
        <p>This link expires in 48 hours.</p>
      `,
    });
  } catch (err) {
    console.error("Failed to send welcome email", err);
  }

  return NextResponse.json({ data: { student: newStudent, user: newUser, profileCompletion } });
}
