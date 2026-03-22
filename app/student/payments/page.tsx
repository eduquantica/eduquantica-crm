import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import StudentPaymentsPageClient from "./StudentPaymentsPageClient";

export const metadata = {
  title: "My Payments",
  description: "View outstanding and paid invoices",
};

export default async function StudentPaymentsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.roleName !== "STUDENT") {
    redirect("/student");
  }

  // Get student ID from user
  const user = await db.user.findUnique({
    where: { email: session.user.email! },
    include: { student: { select: { id: true } } },
  });

  if (!user?.student) {
    redirect("/student");
  }

  return <StudentPaymentsPageClient studentId={user.student.id} />;
}
