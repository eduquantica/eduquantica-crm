import { NextRequest, NextResponse } from "next/server";
import { ProgrammeLevel } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { findCountryRequirement, mapCourseToProgrammeLevel, normalizeCountryCode } from "@/lib/country-entry-requirements";

const querySchema = z.object({
  studentNationality: z.string().optional(),
  programmeLevel: z.nativeEnum(ProgrammeLevel).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    studentNationality: req.nextUrl.searchParams.get("studentNationality") ?? undefined,
    programmeLevel: (req.nextUrl.searchParams.get("programmeLevel") as ProgrammeLevel | null) ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid query" }, { status: 400 });
  }

  const course = await db.course.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      level: true,
      fieldOfStudy: true,
      entryRequirement: {
        include: {
          subjectRequirements: true,
          countryRequirements: {
            include: {
              requiredSubjects: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const entryReq = course.entryRequirement;
  if (!entryReq) {
    return NextResponse.json({
      data: {
        source: "general",
        resolvedRequirement: null,
        countryCode: normalizeCountryCode(parsed.data.studentNationality),
        programmeLevel: parsed.data.programmeLevel || mapCourseToProgrammeLevel({ courseLevel: course.level, courseName: course.name }),
        generalRequirement: null,
      },
    });
  }

  const resolvedProgrammeLevel = parsed.data.programmeLevel
    || mapCourseToProgrammeLevel({ courseLevel: course.level, courseName: course.name });

  const match = findCountryRequirement({
    countryRequirements: entryReq.countryRequirements,
    studentNationality: parsed.data.studentNationality,
    programmeLevel: resolvedProgrammeLevel,
  });

  return NextResponse.json({
    data: {
      source: match.source,
      resolvedRequirement: match.requirement,
      countryCode: normalizeCountryCode(parsed.data.studentNationality),
      programmeLevel: resolvedProgrammeLevel,
      generalRequirement: {
        overallDescription: entryReq.overallDescription,
        overallMinUniversal: entryReq.overallMinUniversal,
        englishReqIelts: entryReq.englishReqIelts,
        englishReqPte: entryReq.englishReqPte,
        englishReqToefl: entryReq.englishReqToefl,
        subjectRequirements: entryReq.subjectRequirements,
      },
    },
  });
}
