import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_DECLARATION = "I confirm that the information and supporting documents I have provided are true, complete, and accurate to the best of my knowledge. I understand that any false information may lead to application rejection or withdrawal.";

const STAFF_ROLES = ["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT"];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleName = session.user.roleName;

    // Staff access: fetch declarations for a specific student via ?studentId=
    if (STAFF_ROLES.includes(roleName)) {
      const { searchParams } = new URL(req.url);
      const studentId = searchParams.get("studentId");
      if (!studentId) {
        return NextResponse.json({ error: "studentId is required for staff access" }, { status: 400 });
      }
      const declarations = await db.studentDeclaration.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          applicationId: true,
          declarationText: true,
          signatureName: true,
          signedAt: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ data: declarations, defaultDeclarationText: DEFAULT_DECLARATION });
    }

    // Student access: fetch own declarations
    if (roleName !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const declarations = await db.studentDeclaration.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        applicationId: true,
        declarationText: true,
        signatureName: true,
        signedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: declarations, defaultDeclarationText: DEFAULT_DECLARATION });
  } catch (error) {
    console.error("[/api/student/declarations GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      applicationId?: string | null;
      declarationText?: string;
      signatureName?: string;
    };

    const declarationText = (body.declarationText || DEFAULT_DECLARATION).trim();
    const signatureName = (body.signatureName || "").trim();

    if (!signatureName) {
      return NextResponse.json({ error: "Signature name is required" }, { status: 400 });
    }

    if (declarationText.length < 40) {
      return NextResponse.json({ error: "Declaration text is too short" }, { status: 400 });
    }

    if (body.applicationId) {
      const application = await db.application.findUnique({
        where: { id: body.applicationId },
        select: { id: true, studentId: true },
      });
      if (!application || application.studentId !== student.id) {
        return NextResponse.json({ error: "Invalid application" }, { status: 400 });
      }
    }

    const created = await db.studentDeclaration.create({
      data: {
        studentId: student.id,
        applicationId: body.applicationId || null,
        declarationText,
        signatureName,
        signedAt: new Date(),
      },
      select: {
        id: true,
        applicationId: true,
        declarationText: true,
        signatureName: true,
        signedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[/api/student/declarations POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
