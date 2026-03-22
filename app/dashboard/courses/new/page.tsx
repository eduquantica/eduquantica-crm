import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import AddCourseForm from "./AddCourseForm";

export const metadata = {
  title: "Add Course",
  description: "Create a new course",
};

export default async function AddCoursePage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "COUNSELLOR")) {
    redirect("/dashboard");
  }

  // Fetch all active universities
  const universities = await db.university.findMany({
    where: { isActive: true },
    select: { id: true, name: true, country: true, currency: true },
    orderBy: { name: "asc" },
  });

  return <AddCourseForm universities={universities} />;
}
