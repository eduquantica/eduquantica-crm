import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function staffGuard(session: unknown) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (session as any).user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { universityId, university, courses } = body as {
      universityId?: string;
      university?: Record<string, unknown>;
      courses?: Record<string, unknown>[];
    };

    if (!university || typeof university !== "object") {
      return NextResponse.json({ error: "Missing university data" }, { status: 400 });
    }

    // helper to coerce
    const str = (val: unknown) => (val == null ? null : String(val));
    const num = (val: unknown) => {
      const s = str(val);
      if (s == null || s === "") return null;
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniPayload: any = {
      name: str(university.name),
      country: str(university.country) || undefined,
      city: str(university.city) || undefined,
      type: university.type ? String(university.type).toUpperCase() : undefined,
      qsRanking: num(university.qsRanking),
      timesHigherRanking: num(university.timesHigherRanking),
      website: str(university.website) || undefined,
      description: str(university.description) || undefined,
      foundedYear: num(university.foundedYear),
      dliNumber: str(university.dliNumber) || undefined,
      applicationFee: num(university.applicationFee),
      contactPerson: str(university.contactPerson) || undefined,
      contactEmail: str(university.contactEmail) || undefined,
      currency: str(university.currency) || undefined,
      logo: str(university.logo) || undefined,
      campusPhotos: Array.isArray(university.campusPhotos) ? (university.campusPhotos as string[]) : undefined,
      isActive: university.isActive === "false" ? false : !!university.isActive,
      postStudyWorkVisa: str(university.postStudyWorkVisa) || undefined,
    };

    let uId = universityId;
    if (uId) {
      await db.university.update({ where: { id: uId }, data: uniPayload });
    } else {
      const created = await db.university.create({ data: uniPayload });
      uId = created.id;
    }

    let createdCount = 0;
    let updatedCount = 0;
    if (Array.isArray(courses)) {
      for (const raw of courses) {
        const name = str(raw.name);
        if (!name) continue;
        // check existing by name
        const existing = await db.course.findFirst({ where: { universityId: uId!, name }});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coursePayload: any = {
          universityId: uId!,
          name,
          level: str(raw.level) || undefined,
          duration: str(raw.duration) || undefined,
          tuitionFee: num(raw.tuitionFee),
          applicationFee: num(raw.applicationFee),
          currency: str(raw.currency) || undefined,
          fieldOfStudy: str(raw.fieldOfStudy) || undefined,
          studyMode: raw.studyMode ? String(raw.studyMode).toUpperCase() : undefined,
          tags: raw.tags ? String(raw.tags).split(",").map((t) => t.trim().toUpperCase()) : undefined,
          description: str(raw.description) || undefined,
          intakeDatesWithDeadlines: undefined, // ignoring for simplicity
          isActive: false,
        };
        if (existing) {
          await db.course.update({ where: { id: existing.id }, data: coursePayload });
          updatedCount++;
        } else {
          await db.course.create({ data: coursePayload });
          createdCount++;
        }
      }
    }

    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "university",
          entityId: uId ?? undefined,
          action: "import_updated_excel",
          details: `courses: created ${createdCount} updated ${updatedCount}`,
        },
      });
    } catch (err) {
      console.error("failed logging import excel", err);
    }

    return NextResponse.json({ data: { universityId: uId, created: createdCount, updated: updatedCount } });
  } catch (e) {
    console.error("[/api/admin/universities/import-excel POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}