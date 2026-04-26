import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.roleName;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await db.student.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { counsellorId } = body as { counsellorId: string | null };

  if (counsellorId) {
    const counsellor = await db.user.findUnique({
      where: { id: counsellorId },
      select: { id: true, role: { select: { name: true } } },
    });
    if (!counsellor) return NextResponse.json({ error: "Counsellor not found" }, { status: 404 });
  }

  const updated = await db.student.update({
    where: { id: params.id },
    data: { assignedCounsellorId: counsellorId ?? null },
    select: {
      id: true,
      assignedCounsellorId: true,
      assignedCounsellor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: updated });
}
