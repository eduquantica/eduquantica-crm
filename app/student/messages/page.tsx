import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import StudentMessagesClient from "./StudentMessagesClient";

export default async function StudentMessagesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.roleName !== "STUDENT") {
    redirect("/login");
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    redirect("/login");
  }

  return <StudentMessagesClient studentId={student.id} />;
}
