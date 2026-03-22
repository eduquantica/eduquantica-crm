import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { StudyGapCalculator } from "@/lib/study-gap";
import { calculateCvCompletion } from "@/lib/cv-completion";

const PAGE_SIZE = 25;

function staffGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const r = session.user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWhere(isCounsellor: boolean, userId: string, p: URLSearchParams): any {
  // using unknown[] here to avoid lint warning while still later casting as needed
  const and: unknown[] = [];

  if (isCounsellor) and.push({ assignedCounsellorId: userId });

  const search = p.get("search")?.trim();
  if (search) {
    and.push({
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { id: { contains: search } },
      ],
    });
  }

  const nationality = p.get("nationality");
  if (nationality) and.push({ nationality });

  const counsellorId = p.get("counsellorId");
  if (counsellorId && !isCounsellor) and.push({ assignedCounsellorId: counsellorId });

  const subAgentId = p.get("subAgentId");
  if (subAgentId) and.push({ subAgentId });

  const from = p.get("from");
  if (from) and.push({ createdAt: { gte: new Date(from) } });

  const to = p.get("to");
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: toDate } });
  }

  const prof = p.get("profileCompletion"); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (prof === "complete") {
    and.push({
      AND: [
        { phone: { not: null } },
        { nationality: { not: null } },
        { dateOfBirth: { not: null } },
        { address: { not: null } },
      ],
    });
  } else if (prof === "incomplete") {
    and.push({
      AND: [
        { phone: null },
        { nationality: null },
        { dateOfBirth: null },
        { address: null },
      ],
    });
  } else if (prof === "partial") {
    and.push({
      NOT: [
        {
          AND: [
            { phone: { not: null } },
            { nationality: { not: null } },
            { dateOfBirth: { not: null } },
            { address: { not: null } },
          ],
        },
        {
          AND: [
            { phone: null },
            { nationality: null },
            { dateOfBirth: null },
            { address: null },
          ],
        },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

const STUDENT_SELECT: Prisma.StudentSelect = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  nationality: true,
  dateOfBirth: true,
  passportNumber: true,
  address: true,
  city: true,
  country: true,
  highestQualification: true,
  grades: true,
  englishTestType: true,
  englishTestScore: true,
  workExperience: true,
  maritalStatus: true,
  emergencyContact: true,
  createdAt: true,
  assignedCounsellorId: true,
  assignedCounsellor: { select: { id: true, name: true } },
  subAgent: { select: { id: true, agencyName: true } },
  mockInterviews: {
    orderBy: { assignedAt: "desc" },
    take: 1,
    select: {
      completedAt: true,
      overallScore: true,
      passingScore: true,
    },
  },
  cvProfile: {
    select: {
      id: true,
      updatedAt: true,
    },
  },
  _count: { select: { applications: true } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeProfileCompletion(student: Record<string, any>): number {
  const fields = [
    "phone",
    "dateOfBirth",
    "nationality",
    "passportNumber",
    "address",
    "city",
    "country",
    "highestQualification",
    "grades",
    "englishTestType",
    "englishTestScore",
    "workExperience",
    "maritalStatus",
    "emergencyContact",
  ];
  const filled = fields.reduce((c, f) => (student[f] ? c + 1 : c), 0);
  return Math.round((filled / fields.length) * 100);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  const p = req.nextUrl.searchParams;

  try {
    const isCounsellor = session!.user.roleName === "COUNSELLOR";
    const userId = session!.user.id;
    const where = buildWhere(isCounsellor, userId, p);

    // CSV export
    if (p.get("export") === "true") {
      const students = await db.student.findMany({
        where,
        select: STUDENT_SELECT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderBy: { createdAt: "desc" } as any,
        take: 5000,
      });

      const header = [
        "Name",
        "Student ID",
        "Email",
        "Phone",
        "Nationality",
        "Counsellor",
        "Sub-Agent",
        "Applications",
        "Profile Completion",
        "Date Added",
      ];
      const rows = students.map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const st = s as any;
        const profile = computeProfileCompletion(st);
        return [
          `${st.firstName} ${st.lastName}`,
          st.id,
          st.email,
          st.phone || "",
          st.nationality || "",
          st.assignedCounsellor?.name ?? "Unassigned",
          st.subAgent?.agencyName ?? "",
          String(st._count.applications),
          profile + "%",
          new Date(st.createdAt).toLocaleDateString("en-GB"),
        ];
      });

      const csv = [header, ...rows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));

    const [total, students] = await Promise.all([
      db.student.count({ where }),
      db.student.findMany({
        where,
        select: STUDENT_SELECT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderBy: { createdAt: "desc" } as any,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    // enrich with computed profileCompletion value (recalculate from DB)
    const enriched = await Promise.all(
      students.map(async (s) => {
        const cvProfile = await db.cvProfile.findUnique({
          where: { userId: s.userId },
          select: {
            updatedAt: true,
            fullName: true,
            email: true,
            professionalTitle: true,
            phone: true,
            country: true,
            profileSummary: true,
            education: { select: { id: true } },
            workExperience: { select: { id: true } },
            skills: { select: { id: true } },
            languages: { select: { id: true } },
            references: { select: { id: true } },
          },
        });

        const [profileCompletion, studyGapIndicator] = await Promise.all([
          calculateProfileCompletion(s.id),
          StudyGapCalculator.calculateGap(s.id),
        ]);

        return {
          ...s,
          profileCompletion,
          cvCompletion: cvProfile
            ? calculateCvCompletion({
                fullName: cvProfile.fullName,
                email: cvProfile.email,
                professionalTitle: cvProfile.professionalTitle,
                phone: cvProfile.phone,
                country: cvProfile.country,
                profileSummary: cvProfile.profileSummary,
                educationCount: cvProfile.education.length,
                workExperienceCount: cvProfile.workExperience.length,
                skillsCount: cvProfile.skills.length,
                languagesCount: cvProfile.languages.length,
                referencesCount: cvProfile.references.length,
              }).total
            : 0,
          cvLastUpdatedAt: cvProfile?.updatedAt || null,
          hasCvProfile: Boolean(cvProfile),
          studyGapIndicator,
          latestMockInterviewResult:
            s.mockInterviews[0]?.completedAt && typeof s.mockInterviews[0].overallScore === "number"
              ? (s.mockInterviews[0].overallScore >= s.mockInterviews[0].passingScore ? "PASS" : "FAIL")
              : null,
        };
      }),
    );

    return NextResponse.json({
      data: {
        students: enriched,
        total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (error) {
    console.error("[/api/admin/students GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load students",
        data: {
          students: [],
          total: 0,
          page: 1,
          pageSize: PAGE_SIZE,
          totalPages: 0,
        },
      },
      { status: 500 },
    );
  }
}
