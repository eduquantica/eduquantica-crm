import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { getNextCounsellor } from "@/lib/counsellor";
import { randomBytes } from "crypto";
import { sendMail } from "@/lib/email";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { ApplicationStatus } from "@prisma/client";
import { generateStudentNumber } from "@/lib/generateIds";
import { StudyGapCalculator } from "@/lib/study-gap";
import { normalizeCountryCode } from "@/lib/financial-requirements";

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  countryOfResidence: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  highestQualification: z.string().optional(),
  yearCompleted: z.string().optional(),
  institutionName: z.string().optional(),
  preferredLevel: z.string().optional(),
  preferredDestination: z.string().optional(),
  preferredFieldOfStudy: z.string().optional(),
  notes: z.string().optional(),
});

function ensureSubAgentSession(
  session: Awaited<ReturnType<typeof getServerSession>>
): session is { user: { id: string; roleName: string } } {
  if (!session || typeof session !== "object") return false;
  const maybeUser = (session as Record<string, unknown>).user;
  if (!maybeUser || typeof maybeUser !== "object") return false;
  const roleName = (maybeUser as Record<string, unknown>).roleName;
  const id = (maybeUser as Record<string, unknown>).id;
  return roleName === "SUB_AGENT" && typeof id === "string";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!ensureSubAgentSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subAgent = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!subAgent) return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });

    const params = req.nextUrl.searchParams;
    const search = (params.get("search") || "").trim();
    const nationality = (params.get("nationality") || "").trim();
    const applicationStatus = (params.get("applicationStatus") || "").trim();
    const normalizedApplicationStatus = Object.values(ApplicationStatus).includes(applicationStatus as ApplicationStatus)
      ? (applicationStatus as ApplicationStatus)
      : null;

    const students = await db.student.findMany({
      where: {
        subAgentId: subAgent.id,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                ...(!isNaN(parseInt(search, 10)) ? [{ studentNumber: parseInt(search, 10) }] : []),
              ],
            }
          : {}),
        ...(nationality ? { nationality } : {}),
        ...(normalizedApplicationStatus
          ? {
              applications: {
                some: { status: normalizedApplicationStatus },
              },
            }
          : {}),
      },
      include: {
        mockInterviews: {
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            completedAt: true,
            overallScore: true,
            passingScore: true,
          },
        },
        applications: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            createdAt: true,
            university: { select: { country: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const latestCountryUpdates = await db.immigrationRuleChangelog.findMany({
      where: {
        alert: { status: "CONFIRMED_PUBLISHED" },
      },
      orderBy: { createdAt: "desc" },
      select: { country: true, createdAt: true },
    });

    const countryUpdateMap = new Map<string, Date>();
    for (const row of latestCountryUpdates) {
      const key = normalizeCountryCode(row.country);
      if (!countryUpdateMap.has(key)) {
        countryUpdateMap.set(key, row.createdAt);
      }
    }

    const rows = await Promise.all(
      students.map(async (student) => {
        const latest = student.applications[0] || null;
        const [profileCompletion, studyGapIndicator] = await Promise.all([
          calculateProfileCompletion(student.id).catch(() => 0),
          StudyGapCalculator.calculateGap(student.id).catch(() => ({
            colour: "GREEN" as const,
            gapYears: 0,
            lastQualification: "Unknown",
          })),
        ]);

        const hasImmigrationUpdate = student.applications.some((application) => {
          const countryCode = normalizeCountryCode(application.university.country);
          const latestUpdate = countryUpdateMap.get(countryCode);
          return Boolean(latestUpdate && latestUpdate > application.createdAt);
        });

        return {
          id: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          subAgentStaffId: student.subAgentStaffId,
          nationality: student.nationality,
          applicationsCount: student.applications.length,
          latestStatus: latest?.status || "APPLIED",
          dateSubmitted: latest?.createdAt?.toISOString() || student.createdAt.toISOString(),
          profileCompletion,
          studyGapIndicator,
          hasImmigrationUpdate,
          latestMockInterviewResult:
            student.mockInterviews[0]?.completedAt && typeof student.mockInterviews[0].overallScore === "number"
              ? (student.mockInterviews[0].overallScore >= student.mockInterviews[0].passingScore ? "PASS" : "FAIL")
              : null,
        };
      }),
    );

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("[api/agent/students GET]", error);
    return NextResponse.json({ error: "Failed to load students", data: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!ensureSubAgentSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subAgent = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true, agencyName: true } });
    if (!subAgent) return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });

    const payload = createSchema.parse(await req.json());
    const email = payload.email.toLowerCase().trim();

    const exists = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    }

    const studentRole = await db.role.findUnique({ where: { name: "STUDENT" }, select: { id: true } });
    if (!studentRole) {
      return NextResponse.json({ error: "Student role not configured" }, { status: 500 });
    }

    const counsellor = await getNextCounsellor();

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: `${payload.firstName} ${payload.lastName}`,
          phone: payload.phone || null,
          roleId: studentRole.id,
          isActive: true,
        },
      });

      const studentNumber = await generateStudentNumber();
      const student = await tx.student.create({
        data: {
          userId: user.id,
          studentNumber,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email,
          phone: payload.phone || null,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          nationality: payload.nationality || null,
          country: payload.countryOfResidence || null,
          passportNumber: payload.passportNumber || null,
          passportExpiry: payload.passportExpiry ? new Date(payload.passportExpiry) : null,
          highestQualification: payload.highestQualification || null,
          grades: payload.yearCompleted || null,
          workExperience: payload.institutionName || null,
          englishTestType: payload.preferredLevel || null,
          englishTestScore: payload.preferredDestination || null,
          address: payload.preferredFieldOfStudy || null,
          emergencyContact: payload.notes || null,
          subAgentId: subAgent.id,
          assignedCounsellorId: counsellor?.id || null,
        },
      });

      await tx.lead.create({
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email,
          phone: payload.phone || null,
          source: "REFERRAL",
          status: "CONVERTED",
          assignedCounsellorId: counsellor?.id || null,
          subAgentId: subAgent.id,
          nationality: payload.nationality || null,
          interestedCountry: payload.preferredDestination || null,
          interestedLevel: payload.preferredLevel || null,
          notes: `Created from sub-agent student registration. studentId=${student.id}. ${payload.notes || ""}`.trim(),
        },
      });

      if (counsellor?.id) {
        await tx.activityLog.create({
          data: {
            userId: counsellor.id,
            entityType: "student",
            entityId: student.id,
            action: "assigned_new_student",
            details: `New student assigned: ${payload.firstName} ${payload.lastName}`,
          },
        });
      }

      const token = randomBytes(32).toString("hex");
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      return { student, token };
    });

    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${result.token}`;

    await StudyGapCalculator.recalculateAndHandleAlerts(result.student.id).catch(() => undefined);

    await sendMail({
      to: email,
      subject: "Welcome to EduQuantica — Set your password",
      text: `Hi ${payload.firstName},\n\nYour student profile was created by ${subAgent.agencyName}.\nSet your password here: ${resetUrl}\n\nThis link expires in 48 hours.`,
      html: `<p>Hi ${payload.firstName},</p><p>Your student profile was created by ${subAgent.agencyName}.</p><p><a href="${resetUrl}">Set your password</a> (expires in 48 hours).</p>`,
    }).catch(() => {});

    if (counsellor?.email) {
      await sendMail({
        to: counsellor.email,
        subject: `New student assigned: ${payload.firstName} ${payload.lastName}`,
        text: `A new student has been assigned to you by sub-agent ${subAgent.agencyName}.`,
      }).catch(() => {});
    }

    return NextResponse.json({ data: { studentId: result.student.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("[api/agent/students POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
