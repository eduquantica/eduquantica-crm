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

const createUniversitySchema = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  type: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  qsRanking: z.number().int().positive().optional().nullable(),
  timesHigherRanking: z.number().int().positive().optional().nullable(),
  website: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  foundedYear: z.number().int().optional().nullable(),
  dliNumber: z.string().optional().nullable(),
  applicationFee: z.number().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  currency: z.string().default("GBP"),
  logo: z.string().optional().nullable(),
  campusPhotos: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const country = url.searchParams.get("country");
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const skip = parseInt(url.searchParams.get("skip") || "0");
    const take = parseInt(url.searchParams.get("take") || "20");

    const where: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (country) {
      where.country = country;
    }
    if (type) {
      where.type = type;
    }
    if (status !== null && status !== undefined) {
      where.isActive = status === "active";
    }

    const [universities, total] = await Promise.all([
      db.university.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          type: true,
          qsRanking: true,
          timesHigherRanking: true,
          isActive: true,
          _count: { select: { courses: true, scholarships: { where: { isActive: true } } } },
        },
      }),
      db.university.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        universities: universities.map((u) => ({
          ...u,
          totalCourses: u._count.courses,
          activeScholarships: u._count.scholarships,
          _count: undefined,
        })),
        total,
        page: Math.floor(skip / take) + 1,
        pageSize: take,
      },
    });
  } catch (e) {
    console.error("[/api/admin/universities GET]", e);
    return NextResponse.json(
      {
        error: "Internal server error",
        data: {
          universities: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = createUniversitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const university = await db.university.create({
      data: parsed.data,
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        type: true,
        qsRanking: true,
        timesHigherRanking: true,
        website: true,
        logo: true,
        description: true,
        foundedYear: true,
        dliNumber: true,
        applicationFee: true,
        currency: true,
        isActive: true,
      },
    });

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "university",
          entityId: university.id,
          action: "created",
          details: `Created university: ${university.name}`,
        },
      });
    } catch (err) {
      console.error("Failed to log activity", err);
    }

    return NextResponse.json({ data: { university } }, { status: 201 });
  } catch (e) {
    console.error("[/api/admin/universities POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
