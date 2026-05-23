import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendMail } from "@/lib/email";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { StudyGapCalculator } from "@/lib/study-gap";
import { generateStudentNumber } from "@/lib/generateIds";
import { checkPermission } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!checkPermission(session, "students", "canCreate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  const lastName = typeof body.lastName === "string" ? body.lastName : "";
  const email = typeof body.email === "string" ? body.email : "";
  const phone = typeof body.phone === "string" ? body.phone : null;
  const nationality = typeof body.nationality === "string" ? body.nationality : null;
  const countryOfResidence = typeof body.countryOfResidence === "string" ? body.countryOfResidence : null;
  const assignedCounsellorId = typeof body.assignedCounsellorId === "string" ? body.assignedCounsellorId : null;
  const subAgentId = typeof body.subAgentId === "string" ? body.subAgentId : null;
  const passportNumber = typeof body.passportNumber === "string" ? body.passportNumber : null;
  const dateOfBirth = typeof body.dateOfBirth === "string" ? new Date(body.dateOfBirth) : null;
  const passportExpiry = typeof body.passportExpiry === "string" ? new Date(body.passportExpiry) : null;

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
      name: `${firstName} ${lastName}`.trim(),
      roleId: studentRole.id,
      isActive: true,
    },
  });

  const studentNumber = await generateStudentNumber();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newStudent = await db.student.create({
    data: {
      userId: newUser.id,
      studentNumber,
      firstName,
      lastName,
      email,
      phone,
      nationality,
      address: countryOfResidence,
      assignedCounsellorId,
      subAgentId,
      dateOfBirth,
      passportNumber,
      passportExpiry,
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
