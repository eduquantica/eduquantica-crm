import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { CountryQualificationType, Prisma, ProgrammeLevel, QualType, SubjectCategory, SubjectReqType } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { EligibilityMatcher } from "@/lib/eligibility-matcher";
import { NotificationService } from "@/lib/notifications";

function canStaff(roleName?: string): boolean {
  return !!roleName && roleName !== "STUDENT" && roleName !== "ADMIN" && roleName !== "SUB_AGENT" && roleName !== "ADMIN";
}

const updateEntryRequirementSchema = z.object({
  acceptedQualTypes: z.array(z.nativeEnum(QualType)).optional(),
  overallMinUniversal: z.number().min(0).max(100).nullable().optional(),
  overallDescription: z.string().nullable().optional(),
  englishReqIelts: z.number().min(0).max(9).nullable().optional(),
  englishReqPte: z.number().min(0).max(90).nullable().optional(),
  englishReqToefl: z.number().min(0).max(120).nullable().optional(),
  additionalNotes: z.string().nullable().optional(),
  subjectRequirements: z.array(z.object({
    subjectName: z.string().min(1),
    subjectAliases: z.array(z.string()).default([]),
    subjectCategory: z.nativeEnum(SubjectCategory).nullable().optional(),
    minimumUniversal: z.number().min(0).max(100).nullable().optional(),
    minimumDescription: z.string().nullable().optional(),
    requirementType: z.nativeEnum(SubjectReqType).default("REQUIRED"),
    isAlternativeGroup: z.boolean().default(false),
    alternativeGroupId: z.string().nullable().optional(),
  })).optional(),
  countryRequirements: z.array(z.object({
    countryCode: z.string().min(1),
    programmeLevel: z.nativeEnum(ProgrammeLevel).default("ALL"),
    qualificationType: z.nativeEnum(CountryQualificationType),
    minGradeDescription: z.string().min(1),
    minUniversalScore: z.number().min(0).max(100).nullable().optional(),
    minimumSubjectsRequired: z.number().int().min(0).nullable().optional(),
    notes: z.string().nullable().optional(),
    requiredSubjects: z.array(z.object({
      subjectName: z.string().min(1),
      minimumGrade: z.string().min(1),
      isMandatory: z.boolean().default(true),
    })).default([]),
    alternativePathwayAccepted: z.boolean().default(false),
    alternativePathwayDetails: z.string().nullable().optional(),
    contextualOfferAvailable: z.boolean().default(false),
    contextualOfferDetails: z.string().nullable().optional(),
    englishSubjectOverride: z.boolean().default(false),
    englishOverrideSubjects: z.string().nullable().optional(),
    englishOverrideIELTS: z.number().min(0).max(9).nullable().optional(),
    ukviIeltsRequired: z.boolean().default(false),
    noEnglishWaiver: z.boolean().default(false),
    transferStudentAccepted: z.boolean().default(false),
    transferStudentDetails: z.string().nullable().optional(),
  })).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entryRequirement = await db.courseEntryRequirement.findUnique({
    where: { courseId: params.id },
    include: {
      subjectRequirements: true,
      countryRequirements: {
        include: {
          requiredSubjects: true,
        },
        orderBy: [
          { countryCode: "asc" },
          { programmeLevel: "asc" },
        ],
      },
    },
  });

  return NextResponse.json({ data: entryRequirement });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const course = await db.course.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  try {
    const parsed = updateEntryRequirementSchema.parse(await req.json());

    await db.$transaction(async (tx) => {
      const entryReq = await tx.courseEntryRequirement.upsert({
        where: { courseId: params.id },
        create: {
          courseId: params.id,
          acceptedQualTypes: parsed.acceptedQualTypes ?? [],
          overallMinUniversal: parsed.overallMinUniversal ?? null,
          overallDescription: parsed.overallDescription ?? null,
          englishReqIelts: parsed.englishReqIelts ?? null,
          englishReqPte: parsed.englishReqPte ?? null,
          englishReqToefl: parsed.englishReqToefl ?? null,
          additionalNotes: parsed.additionalNotes ?? null,
        },
        update: {
          ...(parsed.acceptedQualTypes !== undefined ? { acceptedQualTypes: parsed.acceptedQualTypes } : {}),
          ...(parsed.overallMinUniversal !== undefined ? { overallMinUniversal: parsed.overallMinUniversal } : {}),
          ...(parsed.overallDescription !== undefined ? { overallDescription: parsed.overallDescription } : {}),
          ...(parsed.englishReqIelts !== undefined ? { englishReqIelts: parsed.englishReqIelts } : {}),
          ...(parsed.englishReqPte !== undefined ? { englishReqPte: parsed.englishReqPte } : {}),
          ...(parsed.englishReqToefl !== undefined ? { englishReqToefl: parsed.englishReqToefl } : {}),
          ...(parsed.additionalNotes !== undefined ? { additionalNotes: parsed.additionalNotes } : {}),
        },
      });

      if (parsed.subjectRequirements !== undefined) {
        await tx.courseSubjectRequirement.deleteMany({
          where: { entryReqId: entryReq.id },
        });

        if (parsed.subjectRequirements.length > 0) {
          await tx.courseSubjectRequirement.createMany({
            data: parsed.subjectRequirements.map((item) => ({
              entryReqId: entryReq.id,
              subjectName: item.subjectName,
              subjectAliases: item.subjectAliases,
              subjectCategory: item.subjectCategory ?? null,
              minimumUniversal: item.minimumUniversal ?? null,
              minimumDescription: item.minimumDescription ?? null,
              requirementType: item.requirementType,
              isAlternativeGroup: item.isAlternativeGroup,
              alternativeGroupId: item.alternativeGroupId ?? null,
            })),
          });
        }
      }

      if (parsed.countryRequirements !== undefined) {
        await tx.countryEntryRequirement.deleteMany({
          where: { entryReqId: entryReq.id },
        });

        if (parsed.countryRequirements.length > 0) {
          for (const item of parsed.countryRequirements) {
            await tx.countryEntryRequirement.create({
              data: {
                entryReqId: entryReq.id,
                countryCode: item.countryCode.trim().toUpperCase(),
                programmeLevel: item.programmeLevel,
                qualificationType: item.qualificationType,
                minGradeDescription: item.minGradeDescription,
                minUniversalScore: item.minUniversalScore ?? null,
                minimumSubjectsRequired: item.minimumSubjectsRequired ?? null,
                notes: item.notes ?? null,
                alternativePathwayAccepted: item.alternativePathwayAccepted,
                alternativePathwayDetails: item.alternativePathwayDetails ?? null,
                contextualOfferAvailable: item.contextualOfferAvailable,
                contextualOfferDetails: item.contextualOfferDetails ?? null,
                englishSubjectOverride: item.englishSubjectOverride,
                englishOverrideSubjects: item.englishOverrideSubjects ?? null,
                englishOverrideIELTS: item.englishOverrideIELTS == null
                  ? null
                  : new Prisma.Decimal(item.englishOverrideIELTS),
                ukviIeltsRequired: item.ukviIeltsRequired,
                noEnglishWaiver: item.noEnglishWaiver,
                transferStudentAccepted: item.transferStudentAccepted,
                transferStudentDetails: item.transferStudentDetails ?? null,
                requiredSubjects: {
                  create: item.requiredSubjects.map((subject) => ({
                    subjectName: subject.subjectName,
                    minimumGrade: subject.minimumGrade,
                    isMandatory: subject.isMandatory,
                  })),
                },
              },
            });
          }
        }
      }
    });

    const recalculated = await EligibilityMatcher.recalculateForCourse(params.id);

    const recipients = await db.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ["ADMIN", "MANAGER", "COUNSELLOR"] } },
      },
      select: { id: true },
    });

    await Promise.all(
      recipients.map((recipient) =>
        NotificationService.createNotification({
          userId: recipient.id,
          type: "SYSTEM_IMMIGRATION_RULES_UPDATED",
          message: `Entry requirements updated for ${course.name}.`,
          linkUrl: `/dashboard/courses/${params.id}`,
          actorUserId: session.user.id,
        }).catch(() => undefined),
      ),
    );

    return NextResponse.json({
      data: {
        courseId: params.id,
        recalculatedStudents: recalculated.totalStudents,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    console.error("[/api/admin/courses/[id]/entry-requirements PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
