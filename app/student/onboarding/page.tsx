import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateProfileCompletionDetails } from "@/lib/profile-completion";
import OnboardingWizard from "./OnboardingWizard";

export default async function StudentOnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    redirect("/login");
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      country: true,
      onboardingCompleted: true,
      assignedCounsellor: {
        select: {
          name: true,
          email: true,
        },
      },
      academicProfile: {
        select: {
          _count: {
            select: { qualifications: true },
          },
        },
      },
    },
  });

  if (!student) {
    redirect("/login");
  }

  if (student.onboardingCompleted) {
    redirect("/student/dashboard");
  }

  const [completion, eduviStarted] = await Promise.all([
    calculateProfileCompletionDetails(student.id),
    db.activityLog.findFirst({
      where: {
        entityType: "studentOnboarding",
        entityId: student.id,
        action: "eduvi_started",
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <OnboardingWizard
      studentId={student.id}
      firstName={student.firstName}
      initialDateOfBirth={student.dateOfBirth ? student.dateOfBirth.toISOString().slice(0, 10) : ""}
      initialCountryOfResidence={student.country || ""}
      counsellorName={student.assignedCounsellor?.name || student.assignedCounsellor?.email || "Assigned Counsellor"}
      initialProfileCompletion={completion.percentage}
      initialQualificationCount={student.academicProfile?._count.qualifications ?? 0}
      initialEduviStarted={Boolean(eduviStarted)}
    />
  );
}
