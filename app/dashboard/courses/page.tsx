import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import CoursesClient from "./CoursesClient";

export const metadata = {
  title: "Courses",
  description: "Manage courses and programs",
};

export default async function CoursesPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "COUNSELLOR")) {
    redirect("/dashboard");
  }

  // Fetch all distinct countries where courses are offered
  const countries = await db.course.findMany({
    where: { isActive: true },
    select: { university: { select: { country: true } } },
    distinct: ["universityId"],
  });

  // Fetch all active universities
  const universities = await db.university.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Fetch all distinct fields of study
  const fieldOfStudyData = await db.course.findMany({
    where: { isActive: true, fieldOfStudy: { not: null } },
    select: { fieldOfStudy: true },
    distinct: ["fieldOfStudy"],
  });

  const uniqueCountries = Array.from(new Set(countries.map((c) => c.university.country)));
  const fieldOfStudyOptions = fieldOfStudyData
    .map((f) => f.fieldOfStudy)
    .filter((f): f is string => f !== null)
    .sort();

  return (
    <CoursesClient
      initialCountries={uniqueCountries}
      initialUniversities={universities}
      fieldOfStudyOptions={fieldOfStudyOptions}
    />
  );
}
