import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MockInterviewSession from "@/components/MockInterviewSession";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function StudentMockInterviewRunPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") redirect("/login");

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) redirect("/login");

  const interview = await db.mockInterview.findFirst({
    where: {
      id: params.id,
      studentId: student.id,
    },
    select: { id: true, status: true },
  });

  if (!interview) redirect("/student/mock-interview");
  if (interview.status === "COMPLETED") redirect(`/student/mock-interview/${interview.id}/report`);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4">
      <MockInterviewSession interviewId={interview.id} />
    </main>
  );
}
