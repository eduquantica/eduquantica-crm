import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MockInterviewReport from "@/components/MockInterviewReport";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function StudentMockInterviewReportPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") redirect("/login");

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) redirect("/login");

  const interview = await db.mockInterview.findFirst({
    where: {
      id: params.id,
      studentId: student.id,
    },
    include: {
      application: {
        select: {
          id: true,
          course: {
            select: {
              id: true,
              name: true,
              university: { select: { name: true, country: true } },
            },
          },
        },
      },
      report: true,
    },
  });

  if (!interview) redirect("/student/mock-interview");

  const [eligibility, finance, studentData] = await Promise.all([
    db.courseEligibilityResult.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId: interview.application.course.id } },
      select: { overallMet: true, englishMet: true, matchScore: true },
    }),
    db.financeRecord.findUnique({
      where: { applicationId: interview.applicationId },
      select: { depositPaid: true, totalToShowInBank: true, courseFeeCurrency: true },
    }),
    db.student.findUnique({
      where: { id: student.id },
      select: { englishTestType: true, englishTestScore: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl">
      <MockInterviewReport
        interview={interview}
        eligibility={eligibility}
        finance={finance}
        studentEnglish={studentData}
      />
    </main>
  );
}
