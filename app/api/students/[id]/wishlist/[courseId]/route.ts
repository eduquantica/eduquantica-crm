import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const STAFF_ROLES = ["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"];

function isStaff(roleName?: string | null): boolean {
  return !!roleName && STAFF_ROLES.includes(roleName);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; courseId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isStaff(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await db.student.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await db.studentWishlist.deleteMany({
    where: { studentId: student.id, courseId: params.courseId },
  });

  return NextResponse.json({ data: { ok: true } });
}
