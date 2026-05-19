import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import EditCourseForm from "./EditCourseForm";

export const metadata = {
  title: "Edit Course",
};

export default async function EditCoursePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    (session.user.roleName !== "ADMIN" &&
      session.user.roleName !== "MANAGER" &&
      session.user.roleName !== "COUNSELLOR")
  ) {
    redirect("/dashboard");
  }

  const course = await db.course.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      level: true,
      fieldOfStudy: true,
      duration: true,
      studyMode: true,
      tuitionFee: true,
      applicationFee: true,
      description: true,
      curriculum: true,
      tags: true,
      isActive: true,
      intakeDatesWithDeadlines: true,
      university: {
        select: { id: true, name: true, country: true, currency: true },
      },
    },
  });

  if (!course || !course.fieldOfStudy) notFound();

  return (
    <EditCourseForm course={{ ...course, fieldOfStudy: course.fieldOfStudy ?? "" }} />
  );
}
