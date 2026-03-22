import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateCvCompletion } from "@/lib/cv-completion";
import { NotificationService } from "@/lib/notifications";
import { getAgentScope } from "@/lib/agent-scope";
import type { CvProfilePayload } from "@/lib/cv-types";

type SessionUser = {
  id: string;
  roleName: string;
  name?: string | null;
  isBranchCounsellor?: boolean;
  subAgentStaffId?: string | null;
};

async function canAccessStudentForRole(user: SessionUser, studentId: string): Promise<boolean> {
  if (user.roleName === "ADMIN" || user.roleName === "MANAGER") return true;

  if (user.roleName === "COUNSELLOR") {
    const row = await db.student.findUnique({
      where: { id: studentId },
      select: { assignedCounsellorId: true },
    });
    return row?.assignedCounsellorId === user.id;
  }

  if (user.roleName === "SUB_AGENT") {
    const scope = await getAgentScope();
    if (!scope) return false;
    const row = await db.student.findUnique({
      where: { id: studentId },
      select: { subAgentId: true, subAgentStaffId: true },
    });
    if (!row || row.subAgentId !== scope.subAgentId) return false;
    if (scope.isBranchCounsellor && scope.subAgentStaffId) {
      return row.subAgentStaffId === scope.subAgentStaffId;
    }
    return true;
  }

  return false;
}

async function resolveTarget(user: SessionUser, studentIdParam: string | null) {
  if (studentIdParam) {
    const canAccess = await canAccessStudentForRole(user, studentIdParam);
    if (!canAccess) return null;

    const student = await db.student.findUnique({
      where: { id: studentIdParam },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        nationality: true,
      },
    });

    if (!student) return null;
    return {
      userId: student.userId,
      studentId: student.id,
      defaultFullName: `${student.firstName} ${student.lastName}`.trim(),
      defaultEmail: student.email,
      defaultPhone: student.phone,
      defaultAddress: student.address,
      defaultCity: student.city,
      defaultCountry: student.country,
      defaultNationality: student.nationality,
      isStudentTarget: true,
    };
  }

  if (user.roleName === "STUDENT") {
    const student = await db.student.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        nationality: true,
      },
    });

    return {
      userId: user.id,
      studentId: student?.id || null,
      defaultFullName: student ? `${student.firstName} ${student.lastName}`.trim() : "",
      defaultEmail: student?.email || "",
      defaultPhone: student?.phone || null,
      defaultAddress: student?.address || null,
      defaultCity: student?.city || null,
      defaultCountry: student?.country || null,
      defaultNationality: student?.nationality || null,
      isStudentTarget: true,
    };
  }

  const staff = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, phone: true },
  });

  return {
    userId: user.id,
    studentId: null,
    defaultFullName: staff?.name || "",
    defaultEmail: staff?.email || "",
    defaultPhone: staff?.phone || null,
    defaultAddress: null,
    defaultCity: null,
    defaultCountry: null,
    defaultNationality: null,
    isStudentTarget: false,
  };
}

function sanitizeString(value: string | null | undefined): string | null {
  const normalized = (value || "").trim();
  return normalized ? normalized : null;
}

async function upsertProfile(userId: string, studentId: string | null, defaults: Record<string, string | null>) {
  const existing = await db.cvProfile.findUnique({
    where: { userId },
    include: {
      education: { orderBy: { orderIndex: "asc" } },
      workExperience: { orderBy: { orderIndex: "asc" } },
      skills: { orderBy: { orderIndex: "asc" } },
      languages: { orderBy: { orderIndex: "asc" } },
      references: { orderBy: { orderIndex: "asc" } },
      achievements: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (existing) return existing;

  return db.cvProfile.create({
    data: {
      userId,
      studentId,
      fullName: defaults.fullName,
      email: defaults.email,
      phone: defaults.phone,
      address: defaults.address,
      city: defaults.city,
      country: defaults.country,
      nationality: defaults.nationality,
      templateStyle: "modern",
      showReferences: true,
    },
    include: {
      education: { orderBy: { orderIndex: "asc" } },
      workExperience: { orderBy: { orderIndex: "asc" } },
      skills: { orderBy: { orderIndex: "asc" } },
      languages: { orderBy: { orderIndex: "asc" } },
      references: { orderBy: { orderIndex: "asc" } },
      achievements: { orderBy: { orderIndex: "asc" } },
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const studentIdParam = request.nextUrl.searchParams.get("studentId");
  const target = await resolveTarget(user, studentIdParam);

  if (!target) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await upsertProfile(target.userId, target.studentId, {
    fullName: target.defaultFullName,
    email: target.defaultEmail,
    phone: target.defaultPhone,
    address: target.defaultAddress,
    city: target.defaultCity,
    country: target.defaultCountry,
    nationality: target.defaultNationality,
  });

  const completion = calculateCvCompletion({
    fullName: profile.fullName,
    email: profile.email,
    professionalTitle: profile.professionalTitle,
    phone: profile.phone,
    country: profile.country,
    profileSummary: profile.profileSummary,
    educationCount: profile.education.length,
    workExperienceCount: profile.workExperience.length,
    skillsCount: profile.skills.length,
    languagesCount: profile.languages.length,
    referencesCount: profile.references.length,
  });

  if (profile.isComplete !== (completion.total === 100)) {
    await db.cvProfile.update({
      where: { id: profile.id },
      data: { isComplete: completion.total === 100 },
    });
  }

  return NextResponse.json({
    data: {
      profile,
      completion,
      isStudentTarget: target.isStudentTarget,
      editableByAdmin: user.roleName === "ADMIN" || user.roleName === "MANAGER",
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const studentIdParam = request.nextUrl.searchParams.get("studentId");
  const target = await resolveTarget(user, studentIdParam);
  if (!target) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as CvProfilePayload;
  const profile = await upsertProfile(target.userId, target.studentId, {
    fullName: target.defaultFullName,
    email: target.defaultEmail,
    phone: target.defaultPhone,
    address: target.defaultAddress,
    city: target.defaultCity,
    country: target.defaultCountry,
    nationality: target.defaultNationality,
  });

  const nextEducation = (payload.education || [])
    .filter((row) => sanitizeString(row.institution) && sanitizeString(row.qualification))
    .map((row, index) => ({
      cvProfileId: profile.id,
      institution: sanitizeString(row.institution) || "",
      qualification: sanitizeString(row.qualification) || "",
      fieldOfStudy: sanitizeString(row.fieldOfStudy),
      grade: sanitizeString(row.grade),
      startDate: sanitizeString(row.startDate),
      endDate: sanitizeString(row.endDate),
      isCurrently: Boolean(row.isCurrently),
      description: sanitizeString(row.description),
      country: sanitizeString(row.country),
      autoImported: Boolean(row.autoImported),
      orderIndex: row.orderIndex ?? index,
    }));

  const nextWorkExperience = (payload.workExperience || [])
    .filter((row) => sanitizeString(row.jobTitle) && sanitizeString(row.employer))
    .map((row, index) => ({
      cvProfileId: profile.id,
      jobTitle: sanitizeString(row.jobTitle) || "",
      employer: sanitizeString(row.employer) || "",
      location: sanitizeString(row.location),
      startDate: sanitizeString(row.startDate),
      endDate: sanitizeString(row.endDate),
      isCurrently: Boolean(row.isCurrently),
      responsibilities: sanitizeString(row.responsibilities),
      achievements: sanitizeString(row.achievements),
      orderIndex: row.orderIndex ?? index,
    }));

  const nextSkills = (payload.skills || [])
    .filter((row) => sanitizeString(row.skillName))
    .map((row, index) => ({
      cvProfileId: profile.id,
      skillName: sanitizeString(row.skillName) || "",
      proficiency: sanitizeString(row.proficiency),
      category: sanitizeString(row.category),
      orderIndex: row.orderIndex ?? index,
    }));

  const nextLanguages = (payload.languages || [])
    .filter((row) => sanitizeString(row.language) && sanitizeString(row.proficiency))
    .map((row, index) => ({
      cvProfileId: profile.id,
      language: sanitizeString(row.language) || "",
      proficiency: sanitizeString(row.proficiency) || "",
      orderIndex: row.orderIndex ?? index,
    }));

  const nextReferences = (payload.references || [])
    .filter((row) => sanitizeString(row.refereeName))
    .map((row, index) => ({
      cvProfileId: profile.id,
      refereeName: sanitizeString(row.refereeName) || "",
      jobTitle: sanitizeString(row.jobTitle),
      organisation: sanitizeString(row.organisation),
      email: sanitizeString(row.email),
      phone: sanitizeString(row.phone),
      relationship: sanitizeString(row.relationship),
      orderIndex: row.orderIndex ?? index,
    }));

  const nextAchievements = (payload.achievements || [])
    .filter((row) => sanitizeString(row.title))
    .map((row, index) => ({
      cvProfileId: profile.id,
      title: sanitizeString(row.title) || "",
      description: sanitizeString(row.description),
      date: sanitizeString(row.date),
      orderIndex: row.orderIndex ?? index,
    }));

  const updated = await db.$transaction(async (tx) => {
    await tx.cvEducation.deleteMany({ where: { cvProfileId: profile.id } });
    await tx.cvWorkExperience.deleteMany({ where: { cvProfileId: profile.id } });
    await tx.cvSkill.deleteMany({ where: { cvProfileId: profile.id } });
    await tx.cvLanguage.deleteMany({ where: { cvProfileId: profile.id } });
    await tx.cvReference.deleteMany({ where: { cvProfileId: profile.id } });
    await tx.cvAchievement.deleteMany({ where: { cvProfileId: profile.id } });

    if (nextEducation.length) await tx.cvEducation.createMany({ data: nextEducation });
    if (nextWorkExperience.length) await tx.cvWorkExperience.createMany({ data: nextWorkExperience });
    if (nextSkills.length) await tx.cvSkill.createMany({ data: nextSkills });
    if (nextLanguages.length) await tx.cvLanguage.createMany({ data: nextLanguages });
    if (nextReferences.length) await tx.cvReference.createMany({ data: nextReferences });
    if (nextAchievements.length) await tx.cvAchievement.createMany({ data: nextAchievements });

    const current = await tx.cvProfile.update({
      where: { id: profile.id },
      data: {
        fullName: sanitizeString(payload.fullName) ?? profile.fullName,
        professionalTitle: sanitizeString(payload.professionalTitle),
        email: sanitizeString(payload.email) ?? profile.email,
        phone: sanitizeString(payload.phone),
        address: sanitizeString(payload.address),
        city: sanitizeString(payload.city),
        country: sanitizeString(payload.country),
        nationality: sanitizeString(payload.nationality),
        profilePhotoUrl: sanitizeString(payload.profilePhotoUrl),
        profileSummary: sanitizeString(payload.profileSummary),
        linkedinUrl: sanitizeString(payload.linkedinUrl),
        portfolioUrl: sanitizeString(payload.portfolioUrl),
        templateStyle: sanitizeString(payload.templateStyle) || "modern",
        showReferences: payload.showReferences ?? true,
      },
      include: {
        education: { orderBy: { orderIndex: "asc" } },
        workExperience: { orderBy: { orderIndex: "asc" } },
        skills: { orderBy: { orderIndex: "asc" } },
        languages: { orderBy: { orderIndex: "asc" } },
        references: { orderBy: { orderIndex: "asc" } },
        achievements: { orderBy: { orderIndex: "asc" } },
      },
    });

    const completion = calculateCvCompletion({
      fullName: current.fullName,
      email: current.email,
      professionalTitle: current.professionalTitle,
      phone: current.phone,
      country: current.country,
      profileSummary: current.profileSummary,
      educationCount: current.education.length,
      workExperienceCount: current.workExperience.length,
      skillsCount: current.skills.length,
      languagesCount: current.languages.length,
      referencesCount: current.references.length,
    });

    const finalProfile = await tx.cvProfile.update({
      where: { id: current.id },
      data: {
        isComplete: completion.total === 100,
      },
      include: {
        education: { orderBy: { orderIndex: "asc" } },
        workExperience: { orderBy: { orderIndex: "asc" } },
        skills: { orderBy: { orderIndex: "asc" } },
        languages: { orderBy: { orderIndex: "asc" } },
        references: { orderBy: { orderIndex: "asc" } },
        achievements: { orderBy: { orderIndex: "asc" } },
      },
    });

    return { finalProfile, completion };
  });

  if (target.studentId && target.userId !== user.id) {
    await NotificationService.createNotification({
      userId: target.userId,
      type: "SYSTEM_CV_REVIEWED",
      message: `Your CV has been reviewed and updated by ${user.name || "Admin"}. Click here to view changes.`,
      linkUrl: "/student/cv-builder",
    }).catch(() => undefined);
  }

  return NextResponse.json({
    data: {
      profile: updated.finalProfile,
      completion: updated.completion,
    },
  });
}
