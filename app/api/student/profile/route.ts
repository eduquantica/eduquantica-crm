import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateProfileCompletionDetails } from "@/lib/profile-completion";

const personalSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  dialCode: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().trim().nullable().optional(),
  nationality: z.string().trim().nullable().optional(),
  countryOfResidence: z.string().trim().nullable().optional(),
  profilePhotoUrl: z.string().trim().nullable().optional(),
});

const addressSchema = z.object({
  street: z.string().trim().default(""),
  city: z.string().trim().default(""),
  state: z.string().trim().default(""),
  postalCode: z.string().trim().default(""),
  country: z.string().trim().default(""),
  emergencyName: z.string().trim().default(""),
  emergencyRelationship: z.string().trim().default(""),
  emergencyPhone: z.string().trim().default(""),
  emergencyEmail: z.string().trim().default(""),
});

const passportSchema = z.object({
  passportNumber: z.string().trim().default(""),
  countryOfIssue: z.string().trim().default(""),
  dateOfIssue: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  ocrStatus: z.enum(["VERIFIED", "VERIFYING", "NEEDS_REVIEW", ""]).optional(),
  lastOcrName: z.string().trim().default(""),
  lastOcrNumber: z.string().trim().default(""),
  lastOcrExpiry: z.string().trim().default(""),
  lastDocumentId: z.string().trim().nullable().optional(),
});

const englishTestSchema = z.object({
  id: z.string(),
  testType: z.string(),
  dateTaken: z.string().nullable().optional(),
  isUKVI: z.boolean().default(false),
  overallScore: z.string().default(""),
  listening: z.string().default(""),
  reading: z.string().default(""),
  writing: z.string().default(""),
  speaking: z.string().default(""),
  certificateUrl: z.string().nullable().optional(),
  certificateFileName: z.string().default(""),
  ocrConfirmed: z.boolean().default(false),
});

const otherTestSchema = z.object({
  id: z.string(),
  testType: z.string(),
  isUKVI: z.boolean().default(false),
  score: z.string().default(""),
  dateTaken: z.string().nullable().optional(),
  certificateUrl: z.string().nullable().optional(),
  certificateFileName: z.string().default(""),
  ocrConfirmed: z.boolean().default(false),
});

const testsSchema = z.object({
  englishTests: z.array(englishTestSchema).default([]),
  otherTests: z.array(otherTestSchema).default([]),
});

const refusalSchema = z.object({
  id: z.string(),
  country: z.string().default(""),
  visaType: z.string().default("Student"),
  refusalMonth: z.string().default(""),
  refusalYear: z.string().default(""),
  reason: z.string().default(""),
  resolved: z.boolean().default(false),
  resolutionDetails: z.string().default(""),
});

const immigrationSchema = z.object({
  hasVisaRefusal: z.boolean().default(false),
  refusals: z.array(refusalSchema).default([]),
});

const workSchema = z.object({
  hasWorkExperience: z.boolean().nullable(),
});

const preferencesSchema = z.object({
  preferredDestinations: z.array(z.string()).default([]),
  preferredStudyLevels: z.array(z.string()).default([]),
  preferredFields: z.array(z.string()).default([]),
  preferredIntake: z.string().default("Any"),
  tuitionBudget: z.string().default(""),
  tuitionBudgetCurrency: z.string().default("GBP"),
  preferredCurrencyDisplay: z.string().default(""),
  communicationLanguage: z.string().default("English"),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  financePortalNotifications: z.boolean().default(true),
  financeEmailNotifications: z.boolean().default(true),
  messagePortalNotifications: z.boolean().default(true),
  messageEmailNotifications: z.boolean().default(true),
  privacyProfileVisible: z.boolean().default(true),
  privacyShareAnalytics: z.boolean().default(true),
  privacyAllowMarketing: z.boolean().default(false),
  requestAccountDeletion: z.boolean().default(false),
  accountDeletionReason: z.string().default(""),
});

const patchSchema = z.object({
  tab: z.enum(["personal", "address", "passport", "tests", "work", "immigration", "preferences"]),
  data: z.unknown(),
});

type ExtendedProfile = {
  personal?: {
    dialCode?: string;
    gender?: string;
    profilePhotoUrl?: string;
  };
  address?: z.infer<typeof addressSchema>;
  passport?: {
    countryOfIssue?: string;
    dateOfIssue?: string;
    ocrStatus?: string;
    lastOcrName?: string;
    lastOcrNumber?: string;
    lastOcrExpiry?: string;
    lastDocumentId?: string;
    passportFileUrl?: string;
    passportFileName?: string;
    passportUploadedAt?: string;
  };
};

const ENGLISH_TEST_TYPES = new Set([
  "IELTS Academic",
  "IELTS General",
  "TOEFL iBT",
  "PTE Academic",
  "Duolingo",
  "Cambridge",
]);

async function getStudentContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      nationality: true,
      country: true,
      address: true,
      city: true,
      passportNumber: true,
      passportExpiry: true,
      emergencyContact: true,
      preferredCurrency: true,
      englishTestType: true,
      englishTestScore: true,
      hasWorkExperience: true,
      user: {
        select: {
          avatar: true,
        },
      },
    },
  });

  if (!student) {
    return { error: NextResponse.json({ error: "Student profile not found" }, { status: 404 }) } as const;
  }

  return { session, student } as const;
}

async function readExtended(studentId: string): Promise<ExtendedProfile> {
  const latest = await db.activityLog.findFirst({
    where: {
      entityType: "studentProfile",
      entityId: studentId,
      action: "upsert",
    },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });

  if (!latest?.details) return {};
  try {
    const parsed = JSON.parse(latest.details);
    if (parsed && typeof parsed === "object") {
      return parsed as ExtendedProfile;
    }
  } catch {
    return {};
  }
  return {};
}

async function writeExtended(studentId: string, userId: string, value: ExtendedProfile) {
  await db.activityLog.create({
    data: {
      userId,
      entityType: "studentProfile",
      entityId: studentId,
      action: "upsert",
      details: JSON.stringify(value),
    },
  });
}

export async function GET() {
  const ctx = await getStudentContext();
  if ("error" in ctx) return ctx.error;

  const [extended, testScores, visaRefusals, preferencesRow, completion] = await Promise.all([
    readExtended(ctx.student.id),
    db.studentTestScore.findMany({
      where: { studentId: ctx.student.id },
      orderBy: { createdAt: "asc" },
    }),
    db.studentVisaRefusal.findMany({
      where: { studentId: ctx.student.id },
      orderBy: [{ refusalYear: "desc" }, { createdAt: "desc" }],
    }),
    db.studentPreferences.findUnique({
      where: { studentId: ctx.student.id },
    }),
    calculateProfileCompletionDetails(ctx.student.id),
  ]);

  const passportDocument = extended.passport?.lastDocumentId
    ? await db.document.findFirst({
        where: {
          id: extended.passport.lastDocumentId,
          studentId: ctx.student.id,
          type: "PASSPORT",
        },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          uploadedAt: true,
        },
      })
    : null;

  const englishTests = testScores
    .filter((row) => ENGLISH_TEST_TYPES.has(row.testType))
    .map((row) => ({
      id: row.id,
      testType: row.testType,
      dateTaken: row.dateTaken ? row.dateTaken.toISOString().slice(0, 10) : "",
      isUKVI: row.isUKVI,
      overallScore: row.overallScore || "",
      listening: row.listeningScore || "",
      reading: row.readingScore || "",
      writing: row.writingScore || "",
      speaking: row.speakingScore || "",
      certificateUrl: row.certificateUrl || "",
      certificateFileName: row.certificateFileName || "",
      ocrConfirmed: row.isVerified,
    }));

  const otherTests = testScores
    .filter((row) => !ENGLISH_TEST_TYPES.has(row.testType))
    .map((row) => ({
      id: row.id,
      testType: row.testType,
      isUKVI: row.isUKVI,
      score: row.overallScore || "",
      dateTaken: row.dateTaken ? row.dateTaken.toISOString().slice(0, 10) : "",
      certificateUrl: row.certificateUrl || "",
      certificateFileName: row.certificateFileName || "",
      ocrConfirmed: row.isVerified,
    }));

  let emergency = {
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    emergencyEmail: "",
  };

  if (ctx.student.emergencyContact) {
    try {
      const parsed = JSON.parse(ctx.student.emergencyContact) as Record<string, string>;
      emergency = {
        emergencyName: parsed.emergencyName || "",
        emergencyRelationship: parsed.emergencyRelationship || "",
        emergencyPhone: parsed.emergencyPhone || "",
        emergencyEmail: parsed.emergencyEmail || "",
      };
    } catch {
      emergency = {
        emergencyName: ctx.student.emergencyContact,
        emergencyRelationship: "",
        emergencyPhone: "",
        emergencyEmail: "",
      };
    }
  }

  return NextResponse.json({
    data: {
      studentId: ctx.student.id,
      personal: {
        firstName: ctx.student.firstName || "",
        lastName: ctx.student.lastName || "",
        email: ctx.student.email || "",
        dialCode: extended.personal?.dialCode || "+44",
        phone: ctx.student.phone || "",
        dateOfBirth: ctx.student.dateOfBirth ? ctx.student.dateOfBirth.toISOString().slice(0, 10) : "",
        gender: extended.personal?.gender || "",
        nationality: ctx.student.nationality || "",
        countryOfResidence: ctx.student.country || "",
        profilePhotoUrl: extended.personal?.profilePhotoUrl || ctx.student.user.avatar || "",
      },
      address: {
        street: ctx.student.address || "",
        city: ctx.student.city || "",
        state: extended.address?.state || "",
        postalCode: extended.address?.postalCode || "",
        country: extended.address?.country || ctx.student.country || "",
        ...emergency,
      },
      passport: {
        passportNumber: ctx.student.passportNumber || "",
        countryOfIssue: extended.passport?.countryOfIssue || "",
        dateOfIssue: extended.passport?.dateOfIssue || "",
        expiryDate: ctx.student.passportExpiry ? ctx.student.passportExpiry.toISOString().slice(0, 10) : "",
        ocrStatus: extended.passport?.ocrStatus || "",
        lastOcrName: extended.passport?.lastOcrName || "",
        lastOcrNumber: extended.passport?.lastOcrNumber || "",
        lastOcrExpiry: extended.passport?.lastOcrExpiry || "",
        lastDocumentId: passportDocument?.id || extended.passport?.lastDocumentId || "",
        passportFileUrl: passportDocument?.fileUrl || "",
        passportFileName: passportDocument?.fileName || "",
        passportUploadedAt: passportDocument?.uploadedAt.toISOString() || "",
      },
      tests: {
        englishTests,
        otherTests,
      },
      work: {
        hasWorkExperience: ctx.student.hasWorkExperience,
      },
      immigration: {
        hasVisaRefusal: visaRefusals.length > 0,
        refusals: visaRefusals.map((row) => ({
          id: row.id,
          country: row.country,
          visaType: row.visaType,
          refusalMonth: row.refusalMonth,
          refusalYear: String(row.refusalYear),
          reason: row.reason || "",
          resolved: row.isResolved,
          resolutionDetails: row.resolvedExplanation || "",
        })),
      },
      preferences: {
        preferredDestinations: Array.isArray(preferencesRow?.preferredDestinations) ? preferencesRow?.preferredDestinations as string[] : [],
        preferredStudyLevels: Array.isArray(preferencesRow?.preferredLevels) ? preferencesRow?.preferredLevels as string[] : [],
        preferredFields: Array.isArray(preferencesRow?.preferredFields) ? preferencesRow?.preferredFields as string[] : [],
        preferredIntake: preferencesRow?.preferredIntake || "Any",
        tuitionBudget: preferencesRow?.maxBudget != null ? String(preferencesRow.maxBudget) : "",
        tuitionBudgetCurrency: preferencesRow?.budgetCurrency || "GBP",
        preferredCurrencyDisplay: preferencesRow?.preferredCurrency || ctx.student.preferredCurrency || "",
        communicationLanguage: preferencesRow?.communicationLanguage || "English",
        emailNotifications: preferencesRow?.emailNotifications ?? true,
        smsNotifications: preferencesRow?.smsNotifications ?? false,
        financePortalNotifications: preferencesRow?.financePortalNotifications ?? true,
        financeEmailNotifications: preferencesRow?.financeEmailNotifications ?? true,
        messagePortalNotifications: preferencesRow?.messagePortalNotifications ?? true,
        messageEmailNotifications: preferencesRow?.messageEmailNotifications ?? true,
        privacyProfileVisible: preferencesRow?.privacyProfileVisible ?? true,
        privacyShareAnalytics: preferencesRow?.privacyShareAnalytics ?? true,
        privacyAllowMarketing: preferencesRow?.privacyAllowMarketing ?? false,
        requestAccountDeletion: Boolean(preferencesRow?.accountDeletionRequestedAt),
        accountDeletionReason: preferencesRow?.accountDeletionReason || "",
      },
      completion: {
        percentage: completion.percentage,
        firstIncompleteHref: completion.firstIncompleteHref,
      },
    },
  });
}

export async function PATCH(req: Request) {
  const ctx = await getStudentContext();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = patchSchema.parse(await req.json());
    const existing = await readExtended(ctx.student.id);
    const next: ExtendedProfile = {
      personal: existing.personal || {},
      address: existing.address,
      passport: existing.passport || {},
    };

    if (payload.tab === "personal") {
      const data = personalSchema.parse(payload.data);
      const phone = [data.dialCode || "", data.phone || ""].join(" ").trim();
      await db.student.update({
        where: { id: ctx.student.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          nationality: data.nationality || null,
          country: data.countryOfResidence || null,
        },
      });

      await db.user.update({
        where: { id: ctx.student.userId },
        data: {
          avatar: data.profilePhotoUrl || null,
        },
      });

      next.personal = {
        ...next.personal,
        dialCode: data.dialCode,
        gender: data.gender || "",
        profilePhotoUrl: data.profilePhotoUrl || "",
      };
    }

    if (payload.tab === "address") {
      const data = addressSchema.parse(payload.data);

      await db.student.update({
        where: { id: ctx.student.id },
        data: {
          address: data.street || null,
          city: data.city || null,
          country: data.country || null,
          emergencyContact: JSON.stringify({
            emergencyName: data.emergencyName,
            emergencyRelationship: data.emergencyRelationship,
            emergencyPhone: data.emergencyPhone,
            emergencyEmail: data.emergencyEmail,
          }),
        },
      });

      next.address = data;
    }

    if (payload.tab === "passport") {
      const data = passportSchema.parse(payload.data);
      await db.student.update({
        where: { id: ctx.student.id },
        data: {
          passportNumber: data.passportNumber || null,
          passportExpiry: data.expiryDate ? new Date(data.expiryDate) : null,
        },
      });

      next.passport = {
        ...next.passport,
        countryOfIssue: data.countryOfIssue,
        dateOfIssue: data.dateOfIssue || "",
        ocrStatus: data.ocrStatus || next.passport?.ocrStatus || "",
        lastOcrName: data.lastOcrName,
        lastOcrNumber: data.lastOcrNumber,
        lastOcrExpiry: data.lastOcrExpiry,
        lastDocumentId: data.lastDocumentId || "",
      };
    }

    if (payload.tab === "tests") {
      const data = testsSchema.parse(payload.data);
      const rows = [
        ...data.englishTests.map((row) => ({
          testType: row.testType,
          dateTaken: row.dateTaken ? new Date(row.dateTaken) : null,
          isUKVI: row.isUKVI,
          overallScore: row.overallScore || null,
          listeningScore: row.listening || null,
          readingScore: row.reading || null,
          writingScore: row.writing || null,
          speakingScore: row.speaking || null,
          certificateUrl: row.certificateUrl || null,
          certificateFileName: row.certificateFileName || null,
          isVerified: row.ocrConfirmed,
        })),
        ...data.otherTests.map((row) => ({
          testType: row.testType,
          dateTaken: row.dateTaken ? new Date(row.dateTaken) : null,
          isUKVI: false,
          overallScore: row.score || null,
          listeningScore: null,
          readingScore: null,
          writingScore: null,
          speakingScore: null,
          certificateUrl: row.certificateUrl || null,
          certificateFileName: row.certificateFileName || null,
          isVerified: row.ocrConfirmed,
        })),
      ];

      await db.$transaction(async (transaction) => {
        await transaction.studentTestScore.deleteMany({ where: { studentId: ctx.student.id } });
        if (rows.length > 0) {
          await transaction.studentTestScore.createMany({
            data: rows.map((row) => ({
              studentId: ctx.student.id,
              ...row,
            })),
          });
        }
      });
    }

    if (payload.tab === "immigration") {
      const data = immigrationSchema.parse(payload.data);

      await db.$transaction(async (transaction) => {
        await transaction.studentVisaRefusal.deleteMany({ where: { studentId: ctx.student.id } });

        if (!data.hasVisaRefusal) {
          return;
        }

        const toCreate = data.refusals
          .map((row) => {
            const parsedYear = Number.parseInt(String(row.refusalYear || ""), 10);
            if (!row.country || !row.visaType || !row.refusalMonth || !Number.isFinite(parsedYear)) {
              return null;
            }
            return {
              studentId: ctx.student.id,
              country: row.country,
              visaType: row.visaType,
              refusalMonth: row.refusalMonth,
              refusalYear: parsedYear,
              reason: row.reason || null,
              isResolved: row.resolved,
              resolvedExplanation: row.resolved ? row.resolutionDetails || null : null,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        if (toCreate.length > 0) {
          await transaction.studentVisaRefusal.createMany({ data: toCreate });
        }
      });
    }

    if (payload.tab === "work") {
      const data = workSchema.parse(payload.data);

      await db.student.update({
        where: { id: ctx.student.id },
        data: {
          hasWorkExperience: data.hasWorkExperience,
        },
      });

      if (data.hasWorkExperience === false) {
        await db.workExperience.deleteMany({ where: { studentId: ctx.student.id } });
      }
    }

    if (payload.tab === "preferences") {
      const data = preferencesSchema.parse(payload.data);
      await db.$transaction(async (transaction) => {
        await transaction.studentPreferences.upsert({
          where: { studentId: ctx.student.id },
          update: {
            preferredDestinations: data.preferredDestinations as unknown as Prisma.InputJsonValue,
            preferredLevels: data.preferredStudyLevels as unknown as Prisma.InputJsonValue,
            preferredFields: data.preferredFields as unknown as Prisma.InputJsonValue,
            preferredIntake: data.preferredIntake || null,
            maxBudget: data.tuitionBudget ? Number(data.tuitionBudget) : null,
            budgetCurrency: data.tuitionBudgetCurrency || null,
            preferredCurrency: data.preferredCurrencyDisplay || null,
            communicationLanguage: data.communicationLanguage || null,
            emailNotifications: data.emailNotifications,
            smsNotifications: data.smsNotifications,
            financePortalNotifications: data.financePortalNotifications,
            financeEmailNotifications: data.financeEmailNotifications,
            messagePortalNotifications: data.messagePortalNotifications,
            messageEmailNotifications: data.messageEmailNotifications,
            privacyProfileVisible: data.privacyProfileVisible,
            privacyShareAnalytics: data.privacyShareAnalytics,
            privacyAllowMarketing: data.privacyAllowMarketing,
            accountDeletionRequestedAt: data.requestAccountDeletion ? new Date() : null,
            accountDeletionReason: data.requestAccountDeletion ? data.accountDeletionReason.trim() || null : null,
          },
          create: {
            studentId: ctx.student.id,
            preferredDestinations: data.preferredDestinations as unknown as Prisma.InputJsonValue,
            preferredLevels: data.preferredStudyLevels as unknown as Prisma.InputJsonValue,
            preferredFields: data.preferredFields as unknown as Prisma.InputJsonValue,
            preferredIntake: data.preferredIntake || null,
            maxBudget: data.tuitionBudget ? Number(data.tuitionBudget) : null,
            budgetCurrency: data.tuitionBudgetCurrency || null,
            preferredCurrency: data.preferredCurrencyDisplay || null,
            communicationLanguage: data.communicationLanguage || null,
            emailNotifications: data.emailNotifications,
            smsNotifications: data.smsNotifications,
            financePortalNotifications: data.financePortalNotifications,
            financeEmailNotifications: data.financeEmailNotifications,
            messagePortalNotifications: data.messagePortalNotifications,
            messageEmailNotifications: data.messageEmailNotifications,
            privacyProfileVisible: data.privacyProfileVisible,
            privacyShareAnalytics: data.privacyShareAnalytics,
            privacyAllowMarketing: data.privacyAllowMarketing,
            accountDeletionRequestedAt: data.requestAccountDeletion ? new Date() : null,
            accountDeletionReason: data.requestAccountDeletion ? data.accountDeletionReason.trim() || null : null,
          },
        });

        await transaction.student.update({
          where: { id: ctx.student.id },
          data: {
            preferredCurrency: data.preferredCurrencyDisplay || null,
          },
        });
      });
    }

    if (payload.tab === "personal" || payload.tab === "address" || payload.tab === "passport") {
      await writeExtended(ctx.student.id, ctx.session.user.id, next);
    }

    const completion = await calculateProfileCompletionDetails(ctx.student.id);
    return NextResponse.json({
      data: {
        ok: true,
        completion: {
          percentage: completion.percentage,
          firstIncompleteHref: completion.firstIncompleteHref,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/profile PATCH]", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}