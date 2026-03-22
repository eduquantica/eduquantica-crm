import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ImportCoursesClient from "./ImportCoursesClient";

export const metadata = {
  title: "Import Courses",
  description: "Bulk import courses for university",
};

interface ImportPageProps {
  params: { id: string };
}

export default async function ImportCoursesPage({ params }: ImportPageProps) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "COUNSELLOR")) {
    redirect("/dashboard");
  }

  return <ImportCoursesClient universityId={params.id} />;
}
