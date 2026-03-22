import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { CourseTag } from "@prisma/client";

function staffGuard(session: unknown) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (session as any).user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const importRowSchema = z.object({
  course_name: z.string().min(1),
  level: z.enum(["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELORS", "MASTERS", "PHD"]),
  field_of_study: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  study_mode: z.enum(["FULL_TIME", "PART_TIME", "ONLINE"]).optional(),
  tuition_fee: z.union([z.string(), z.number()]).optional().nullable(),
  application_fee: z.union([z.string(), z.number()]).optional().nullable(),
  intake_dates: z.string().optional().nullable(),
  application_deadline: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional().nullable(),
});


function parseIntakes(datesStr?: string, deadlinesStr?: string) {
  if (!datesStr) return [];
  const dates = datesStr.split(";").map((s) => s.trim()).filter(Boolean);
  const deadlines = deadlinesStr ? deadlinesStr.split(";").map((s) => s.trim()) : [];
  const out: { date: string; deadline: string }[] = [];
  dates.forEach((d, i) => {
    out.push({ date: d, deadline: deadlines[i] || "" });
  });
  return out;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const rows = body.rows;
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // fetch university currency for default
    const university = await db.university.findUnique({ where: { id: params.id } });
    if (!university) {
      return NextResponse.json({ error: "University not found" }, { status: 404 });
    }

    let imported = 0;
    let skipped = 0;

    for (const raw of rows as unknown[]) {
      const parsed = importRowSchema.safeParse(raw);
      if (!parsed.success) {
        skipped++;
        continue;
      }
      const data = parsed.data;

      // check duplicate course name at this university
      const exists = await db.course.findFirst({
        where: { universityId: params.id, name: data.course_name },
      });
      if (exists) {
        skipped++;
        continue;
      }

      const tagsArray = data.tags
        ? data.tags.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
        : [];
      const intakes = parseIntakes(data.intake_dates || undefined, data.application_deadline || undefined);

      await db.course.create({
        data: {
          universityId: params.id,
          name: data.course_name,
          level: data.level,
          fieldOfStudy: data.field_of_study || undefined,
          duration: data.duration || undefined,
          studyMode: data.study_mode || "FULL_TIME",
          tuitionFee: data.tuition_fee ? parseFloat(String(data.tuition_fee)) : undefined,
          applicationFee: data.application_fee ? parseFloat(String(data.application_fee)) : undefined,
          currency: university.currency || "GBP",
          tags: tagsArray as unknown as CourseTag[],
          description: data.description || undefined,
          intakeDatesWithDeadlines: intakes.length ? intakes : undefined,
          isActive: data.status === "inactive" ? false : true,
        },
      });
      imported++;
    }

    // log activity
    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "university",
          entityId: params.id,
          action: "bulk_import_courses",
          details: `Imported ${imported} courses, skipped ${skipped}`,
        },
      });
    } catch (err) {
      console.error("Failed to log activity", err);
    }

    return NextResponse.json({ data: { imported, skipped } });
  } catch (e) {
    console.error("[/api/admin/universities/[id]/import-courses POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
