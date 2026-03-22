import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function staffGuard(session: any) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (session as any).user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT" || r === "BRANCH_MANAGER" || r === "SUB_AGENT_COUNSELLOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
  level: z.enum(["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELORS", "MASTERS", "PHD"]).optional(),
  fieldOfStudy: z.string().optional(),
  duration: z.string().optional(),
  studyMode: z.enum(["FULL_TIME", "PART_TIME", "ONLINE"]).optional(),
  tuitionFee: z.number().positive().optional(),
  applicationFee: z.number().positive().optional(),
  tags: z.array(z.enum([
    "FAST_ACCEPTANCE",
    "INSTANT_OFFER",
    "POPULAR",
    "HIGH_JOB_DEMAND",
    "TOP",
    "PRIME",
    "NO_VISA_CAP",
    "LOANS_AVAILABLE"
  ])).optional(),
  description: z.string().optional(),
  curriculum: z.string().optional(),
  intakeDatesWithDeadlines: z.any().optional(),
  totalEnrolledStudents: z.number().int().nonnegative().optional(),
  completionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const course = await db.course.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        duration: true,
        studyMode: true,
        tuitionFee: true,
        currency: true,
        applicationFee: true,
        tags: true,
        description: true,
        curriculum: true,
        isActive: true,
        intakeDatesWithDeadlines: true,
        totalEnrolledStudents: true,
        completionRate: true,
        createdAt: true,
        updatedAt: true,
        universityId: true,
        university: {
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
            logo: true,
            website: true,
            description: true,
            currency: true,
          },
        },
        _count: {
          select: {
            applications: true,
            scholarships: { where: { isActive: true } },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get similar programs (same university or same field of study)
    const similarPrograms = await db.course.findMany({
      where: {
        isActive: true,
        OR: [
          { universityId: course.universityId },
          { fieldOfStudy: course.fieldOfStudy },
        ],
        NOT: { id: course.id },
      },
      take: 5,
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        tuitionFee: true,
        currency: true,
        universityId: true,
        university: { select: { name: true, country: true } },
      },
    });

    return NextResponse.json({
      data: {
        course: {
          ...course,
          totalApplications: course._count.applications,
          activeScholarships: course._count.scholarships,
          _count: undefined,
        },
        similarPrograms,
      },
    });
  } catch (e) {
    console.error("[/api/admin/courses/[id] GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = updateCourseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const course = await db.course.update({
      where: { id: params.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        level: true,
        fieldOfStudy: true,
        duration: true,
        studyMode: true,
        tuitionFee: true,
        currency: true,
        applicationFee: true,
        tags: true,
        description: true,
        curriculum: true,
        isActive: true,
        intakeDatesWithDeadlines: true,
        universityId: true,
        university: { select: { id: true, name: true } },
      },
    });

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "course",
          entityId: course.id,
          action: "updated",
          details: `Updated course: ${course.name}`,
        },
      });
    } catch (err) {
      console.error("Failed to log activity", err);
    }

    return NextResponse.json({ data: { course } });
  } catch (e) {
    console.error("[/api/admin/courses/[id] PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
