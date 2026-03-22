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

  const checklist = await db.documentChecklist.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    select: {
      signedPdfUrl: true,
      items: {
        select: {
          status: true,
          documentId: true,
        },
      },
    },
  });

  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  const allVerified = checklist.items.length > 0 && checklist.items.every((item) => item.status === "VERIFIED" && !!item.documentId);

  if (!allVerified) {
    return NextResponse.json({ error: "Checklist is not fully verified yet" }, { status: 400 });
  }

  if (!checklist.signedPdfUrl) {
    return NextResponse.json({ error: "Certificate is not generated yet" }, { status: 404 });
  }

  return NextResponse.redirect(checklist.signedPdfUrl);
}
