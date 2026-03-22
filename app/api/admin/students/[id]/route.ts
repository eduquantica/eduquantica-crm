import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { StudyGapCalculator } from "@/lib/study-gap";



export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const studentId = params.id;

    // pull only the fields we need so the returned type still includes foreign keys
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        nationality: true,
        address: true,
        passportNumber: true,
        passportExpiry: true,
        dateOfBirth: true,
        subAgentId: true,
        subAgentStaffId: true,
        assignedCounsellorId: true,
        applications: true,
        user: { select: { id: true, email: true, isActive: true } },
        assignedCounsellor: { select: { id: true, name: true, email: true } },
        subAgent: { select: { id: true, agencyName: true } },
        subAgentStaff: { select: { id: true, name: true, email: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (session.user.roleName === "COUNSELLOR") {
      if (student.assignedCounsellorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // calculate authoritative profile completion
    const profileCompletion = await calculateProfileCompletion(studentId);
    const studyGapIndicator = await StudyGapCalculator.calculateGap(studentId);

    return NextResponse.json({ data: { student, profileCompletion, studyGapIndicator } });
  } catch (error) {
    console.error("[/api/admin/students/[id] GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const studentId = params.id;
    const body = await req.json();

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        email: true,
        phone: true,
        nationality: true,
        address: true,
        passportNumber: true,
        passportExpiry: true,
        subAgentId: true,
        subAgentStaffId: true,
        assignedCounsellorId: true,
        user: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (session.user.roleName === "COUNSELLOR") {
      if (student.assignedCounsellorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (body.subAgentStaffId) {
      const branchCounsellor = await db.subAgentStaff.findUnique({
        where: { id: body.subAgentStaffId },
        select: { id: true, subAgentId: true },
      });
      const targetSubAgentId = body.subAgentId || student.subAgentId;
      if (!branchCounsellor || !targetSubAgentId || branchCounsellor.subAgentId !== targetSubAgentId) {
        return NextResponse.json({ error: "Invalid branch counsellor for selected sub-agent" }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ? body.email.toLowerCase() : student.email,
      phone: body.phone || student.phone,
      nationality: body.nationality || null,
      address: body.address || student.address,
      passportNumber: body.passportNumber || student.passportNumber,
      passportExpiry: body.passportExpiry || student.passportExpiry,
      subAgentId: body.subAgentId || student.subAgentId,
      subAgentStaffId: body.subAgentStaffId || null,
      assignedCounsellorId: body.assignedCounsellorId || student.assignedCounsellorId,
      highestQualification: body.highestQualification || undefined,
      grades: body.grades || undefined,
      workExperience: body.workExperience || undefined,
    };

    // if email changed update user record as well
    if (body.email && student.user) {
      await db.user.update({
        where: { id: student.userId },
        data: { email: body.email.toLowerCase() },
      });
    }

    const updated = await db.student.update({
      where: { id: studentId },
      data: updateData,
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        nationality: true,
        address: true,
        passportNumber: true,
        passportExpiry: true,
        dateOfBirth: true,
        subAgentId: true,
        subAgentStaffId: true,
        assignedCounsellorId: true,
        applications: true,
        user: { select: { id: true, email: true, isActive: true } },
        assignedCounsellor: { select: { id: true, name: true, email: true } },
        subAgent: { select: { id: true, agencyName: true } },
        subAgentStaff: { select: { id: true, name: true, email: true } },
      },
    });

    // recalc profile completion for updated student
    const profileCompletion = await calculateProfileCompletion(studentId);
    const studyGapIndicator = await StudyGapCalculator.recalculateAndHandleAlerts(studentId);

    return NextResponse.json({ data: { student: updated, profileCompletion, studyGapIndicator } });
  } catch (error) {
    console.error("[/api/admin/students/[id] PUT]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
