import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CvBuilderClient from "@/app/student/cv-builder/CvBuilderClient";

export default async function DashboardCvBuilderPage({
  searchParams,
}: {
  searchParams: { studentId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = session.user.roleName;
  if (!(role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR")) {
    redirect("/dashboard");
  }

  return <CvBuilderClient roleName={role} studentId={searchParams.studentId} />;
}
