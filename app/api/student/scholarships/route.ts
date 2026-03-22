import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Not a student" }, { status: 404 });
  }

  const rows = await db.studentScholarshipApplication.findMany({
    where: { studentId: student.id },
    include: {
      scholarship: {
        include: {
          university: {
            select: { id: true, name: true },
          },
          course: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ data: rows });
}
