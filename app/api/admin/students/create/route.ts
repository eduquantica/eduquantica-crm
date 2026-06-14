import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { sendMail } from "@/lib/email";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { StudyGapCalculator } from "@/lib/study-gap";
import { generateStudentNumber } from "@/lib/generateIds";
import { checkPermission } from "@/lib/permissions";

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const isCounsellor = session.user.roleName === "COUNSELLOR";
  if (!isCounsellor && !checkPermission(session, "students", "canCreate")) {
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
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const phone = typeof body.phone === "string" ? body.phone : null;
  const nationality = typeof body.nationality === "string" ? body.nationality : null;
  const countryOfResidence = typeof body.countryOfResidence === "string" ? body.countryOfResidence : null;
  const requestedCounsellorId = typeof body.assignedCounsellorId === "string" ? body.assignedCounsellorId : null;
  const subAgentId = typeof body.subAgentId === "string" ? body.subAgentId : null;
  const passportNumber = typeof body.passportNumber === "string" ? body.passportNumber : null;
  const dateOfBirth = parseOptionalDate(body.dateOfBirth);
  const passportExpiry = parseOptionalDate(body.passportExpiry);
  const assignedCounsellorId = isCounsellor ? session.user.id : requestedCounsellorId;

  if (!firstName.trim() || !lastName.trim()) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    const studentRole = await db.role.findUnique({ where: { name: "STUDENT" } });
    if (!studentRole) {
      return NextResponse.json({ error: "STUDENT role not found" }, { status: 500 });
    }

    let validatedCounsellorId: string | null = assignedCounsellorId;
    if (validatedCounsellorId) {
      const assignedCounsellor = await db.user.findUnique({
        where: { id: validatedCounsellorId },
        select: { id: true, role: { select: { name: true } }, isActive: true },
      });
      if (!assignedCounsellor || assignedCounsellor.role.name !== "COUNSELLOR" || !assignedCounsellor.isActive) {
        validatedCounsellorId = null;
      }
    }

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          roleId: studentRole.id,
          isActive: true,
        },
      });

      const studentDataBase = {
        userId: user.id,
        firstName,
        lastName,
        email,
        phone,
        nationality,
        address: countryOfResidence,
        assignedCounsellorId: validatedCounsellorId,
        subAgentId,
        dateOfBirth,
        passportNumber,
        passportExpiry,
      };

      let student;
      try {
        const studentNumber = await generateStudentNumber();
        student = await tx.student.create({
          data: {
            ...studentDataBase,
            studentNumber,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        });
      } catch (err) {
        // Keep student creation resilient if number allocation fails in specific DB states.
        student = await tx.student.create({
          data: {
            ...studentDataBase,
            studentNumber: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        });
        console.error("Student number generation/insert failed, created without studentNumber", err);
      }

      return { user, student };
    });

    const newUser = created.user;
    const newStudent = created.student;

    // non-fatal side effects
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
      console.error("Failed to write activity log for student creation", err);
    }

    await calculateProfileCompletion(newStudent.id).catch(() => 0);
    await StudyGapCalculator.recalculateAndHandleAlerts(newStudent.id).catch(() => undefined);

    try {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await db.passwordResetToken.create({ data: { token, userId: newUser.id, expiresAt } });

      const setPasswordUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
      await sendMail({
        to: email,
        subject: "Welcome to EduQuantica — Set Your Password",
        text: `Welcome to EduQuantica, ${firstName}!\n\nYour student account has been created. Set your password:\n\n${setPasswordUrl}\n\nThis link expires in 48 hours.`,
        html: `
          <h2>Welcome to EduQuantica, ${firstName}!</h2>
          <p>Your student account has been created. To get started, set your password by clicking below:</p>
          <p><a href="${setPasswordUrl}" style="background-color:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Set Password</a></p>
          <p>This link expires in 48 hours.</p>
        `,
      });
    } catch (err) {
      console.error("Failed to send welcome email", err);
    }

    return NextResponse.json({ data: { student: newStudent, user: newUser } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ error: "Invalid counsellor or related reference" }, { status: 400 });
      }
    }
    console.error("[/api/admin/students/create POST]", error);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
