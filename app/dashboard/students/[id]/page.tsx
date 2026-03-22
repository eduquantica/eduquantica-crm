import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import StudentDetailClient from "./StudentDetailClient";
import { StudyGapCalculator } from "@/lib/study-gap";

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return <p className="p-6">Unauthorized</p>;
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      nationality: true,
      address: true,
      passportNumber: true,
      passportExpiry: true,
      dateOfBirth: true,
      subAgentId: true,
      subAgentStaffId: true,
      assignedCounsellorId: true,
      user: { select: { id: true, email: true, isActive: true } },
      assignedCounsellor: { select: { id: true, name: true, email: true } },
      subAgent: { select: { id: true, agencyName: true } },
      subAgentStaff: { select: { id: true, name: true, email: true } },
      mockInterviews: {
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          completedAt: true,
          overallScore: true,
          passingScore: true,
        },
      },
    },
  });

  if (!student) {
    return <p className="p-6">Student not found</p>;
  }

  // counsellor filter
  if (session.user.roleName === "COUNSELLOR" && student.assignedCounsellorId !== session.user.id) {
    return <p className="p-6">Forbidden</p>;
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileCompletion = computeProfileCompletion(student as any);
  const studyGapIndicator = await StudyGapCalculator.calculateGap(student.id);
  const latestMockInterviewResult =
    student.mockInterviews[0]?.completedAt && typeof student.mockInterviews[0].overallScore === "number"
      ? (student.mockInterviews[0].overallScore >= student.mockInterviews[0].passingScore ? "PASS" : "FAIL")
      : null;

  return (
    <StudentDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialStudent={student as any}
      profileCompletion={profileCompletion}
      studyGapIndicator={studyGapIndicator}
      latestMockInterviewResult={latestMockInterviewResult}
      session={session}
      userRole={session.user.roleName}
      userId={session.user.id}
    />
  );
}
