import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

type AutoImportPreview = {
  qualificationCount: number;
  languageHint: string | null;
  workExperienceCount: number;
};

function buildQualificationDescription(subjects: Array<{ subjectName: string; rawGrade: string | null }>): string {
  if (!subjects.length) return "";
  return subjects
    .map((subject) => `${subject.subjectName}${subject.rawGrade ? `: ${subject.rawGrade}` : ""}`)
    .join("; ");
}

function formatDateForCv(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function getCvAutoImportPreview(studentId: string): Promise<AutoImportPreview> {
  const profile = await db.studentAcademicProfile.findUnique({
    where: { studentId },
    include: { qualifications: { select: { id: true } } },
  });

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      englishTestType: true,
      englishTestScore: true,
      workExperiences: { select: { id: true } },
      testScores: {
        where: {
          testType: { in: ["IELTS", "IELTS Academic", "IELTS General", "PTE", "TOEFL", "Duolingo"] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { testType: true, overallScore: true },
      },
    },
  });

  let languageHint: string | null = null;
  const latestScore = student?.testScores?.[0];
  if (latestScore?.testType && latestScore?.overallScore) {
    languageHint = `${latestScore.testType} ${latestScore.overallScore}`;
  } else if (student?.englishTestType && student.englishTestScore) {
    languageHint = `${student.englishTestType} ${student.englishTestScore}`;
  }

  return {
    qualificationCount: profile?.qualifications.length || 0,
    languageHint,
    workExperienceCount: student?.workExperiences.length || 0,
  };
}

export async function autoImportCvFromStudentData(args: {
  studentId: string;
  userId: string;
  cvProfileId: string;
}) {
  const { studentId, userId, cvProfileId } = args;

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      academicProfile: {
        include: {
          qualifications: {
            include: {
              subjects: {
                orderBy: { createdAt: "asc" },
                select: { subjectName: true, rawGrade: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      testScores: {
        where: {
          testType: { in: ["IELTS", "IELTS Academic", "IELTS General", "PTE", "TOEFL", "Duolingo"] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { testType: true, overallScore: true },
      },
      workExperiences: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

  await db.cvProfile.update({
    where: { id: cvProfileId },
    data: {
      fullName: fullName || undefined,
      email: student.email || undefined,
      phone: student.phone || undefined,
      nationality: student.nationality || undefined,
      address: student.address || undefined,
      city: student.city || undefined,
      country: student.country || undefined,
    },
  });

  const existingAutoImported = await db.cvEducation.findMany({
    where: { cvProfileId, autoImported: true },
    select: { id: true },
  });

  if (existingAutoImported.length) {
    await db.cvEducation.deleteMany({
      where: { id: { in: existingAutoImported.map((row) => row.id) } },
    });
  }

  const qualifications = student.academicProfile?.qualifications || [];
  if (qualifications.length) {
    await db.cvEducation.createMany({
      data: qualifications.map((qualification, index) => ({
        cvProfileId,
        institution: qualification.institutionName || "Institution",
        qualification: qualification.qualName,
        fieldOfStudy: qualification.qualType,
        grade: qualification.overallGrade,
        startDate: qualification.yearCompleted ? String(qualification.yearCompleted - 1) : null,
        endDate: qualification.yearCompleted ? String(qualification.yearCompleted) : null,
        description: buildQualificationDescription(qualification.subjects),
        autoImported: true,
        orderIndex: index,
      })),
    });
  }

  const existingEnglish = await db.cvLanguage.findFirst({
    where: { cvProfileId, language: { equals: "English", mode: "insensitive" } },
    select: { id: true },
  });

  const latestScore = student.testScores[0];
  const proficiency = latestScore?.overallScore
    ? `${latestScore.testType} ${latestScore.overallScore}`
    : student.englishTestScore
      ? `${student.englishTestType || "English Test"} ${student.englishTestScore}`
      : null;

  if (proficiency) {
    if (existingEnglish) {
      await db.cvLanguage.update({
        where: { id: existingEnglish.id },
        data: { proficiency },
      });
    } else {
      const languageCount = await db.cvLanguage.count({ where: { cvProfileId } });
      await db.cvLanguage.create({
        data: {
          cvProfileId,
          language: "English",
          proficiency,
          orderIndex: languageCount,
        },
      });
    }
  }

  const existingWorkCount = await db.cvWorkExperience.count({ where: { cvProfileId } });
  const studentWork = student.workExperiences || [];
  let importedWorkExperience = 0;

  if (existingWorkCount === 0 && studentWork.length > 0) {
    await db.cvWorkExperience.createMany({
      data: studentWork.map((row, index) => ({
        cvProfileId,
        jobTitle: row.jobTitle,
        employer: row.employerName,
        location: row.location || null,
        startDate: formatDateForCv(row.startDate),
        endDate: row.isCurrentlyWorking ? null : formatDateForCv(row.endDate),
        isCurrently: row.isCurrentlyWorking,
        responsibilities: row.responsibilities || null,
        achievements: null,
        orderIndex: row.orderIndex ?? index,
      })),
    });
    importedWorkExperience = studentWork.length;
  }

  await NotificationService.createNotification({
    userId,
    type: "SYSTEM_CV_AUTO_IMPORTED",
    message: "We found your academic records and pre-filled your CV. Click here to review and complete your CV.",
    linkUrl: "/student/cv-builder",
  }).catch(() => undefined);

  return {
    importedQualifications: qualifications.length,
    importedEnglishScore: Boolean(proficiency),
    importedWorkExperience,
  };
}
