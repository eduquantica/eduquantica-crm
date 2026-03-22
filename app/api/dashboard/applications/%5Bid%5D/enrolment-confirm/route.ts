import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CommissionService } from "@/lib/commission";
import { sendResendEmail } from "@/lib/resend";
import { calculateSubAgentTier } from "@/lib/subagent-tier";

function isAdmin(roleName?: string) {
  return roleName === "ADMIN";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        visaSubStatus: true,
        universityId: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            subAgentId: true,
          },
        },
        university: {
          select: { name: true },
        },
        course: {
          select: {
            name: true,
            tuitionFee: true,
            currency: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (application.status !== "VISA_APPLIED" || application.visaSubStatus !== "VISA_APPROVED") {
      return NextResponse.json({ error: "Application must be VISA_APPLIED with VISA_APPROVED sub-status" }, { status: 400 });
    }

    const agreement = await db.universityCommissionAgreement.findFirst({
      where: { universityId: application.universityId, isActive: true },
      select: { commissionRate: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "University commission agreement not found" }, { status: 400 });
    }

    const estimated = await CommissionService.calculateCommission(params.id);

    return NextResponse.json({
      data: {
        studentName: `${application.student.firstName} ${application.student.lastName}`,
        university: application.university.name,
        course: application.course.name,
        tuitionFee: application.course.tuitionFee ?? 0,
        currency: application.course.currency || "GBP",
        universityRate: agreement.commissionRate,
        estimated,
      },
    });
  } catch (error) {
    console.error("[enrolment-confirm GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            subAgent: {
              include: { user: true },
            },
          },
        },
        course: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (application.status !== "VISA_APPLIED" || application.visaSubStatus !== "VISA_APPROVED") {
      return NextResponse.json({ error: "Application must be VISA_APPLIED with VISA_APPROVED sub-status" }, { status: 400 });
    }

    const agreement = await db.universityCommissionAgreement.findFirst({
      where: { universityId: application.universityId, isActive: true },
      select: { id: true, commissionRate: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "University commission agreement not found" }, { status: 400 });
    }

    const breakdown = await CommissionService.calculateCommission(application.id);

    const commission = await db.commission.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        universityAgreementId: agreement.id,
        tuitionFee: application.course.tuitionFee ?? 0,
        universityCommRate: agreement.commissionRate,
        grossCommission: breakdown.grossCommission,
        currency: application.course.currency || "GBP",
        subAgentId: application.student.subAgentId,
        agentRateAtTime: breakdown.agentRate,
        agentAmount: breakdown.agentAmount,
        eduquanticaNet: breakdown.eduquanticaNet,
        status: "CALCULATED",
        calculatedAt: new Date(),
        enrolmentConfirmedAt: new Date(),
        confirmedBy: session.user.id,
      },
      update: {
        universityAgreementId: agreement.id,
        tuitionFee: application.course.tuitionFee ?? 0,
        universityCommRate: agreement.commissionRate,
        grossCommission: breakdown.grossCommission,
        currency: application.course.currency || "GBP",
        subAgentId: application.student.subAgentId,
        agentRateAtTime: breakdown.agentRate,
        agentAmount: breakdown.agentAmount,
        eduquanticaNet: breakdown.eduquanticaNet,
        status: "CALCULATED",
        calculatedAt: new Date(),
        enrolmentConfirmedAt: new Date(),
        confirmedBy: session.user.id,
      },
    });

    await db.application.update({
      where: { id: application.id },
      data: { status: "ENROLLED" },
    });

    const subAgent = application.student.subAgent;
    if (application.student.subAgentId && subAgent) {
      await CommissionService.updateTierAfterEnrolment(application.student.subAgentId);
      await calculateSubAgentTier(application.student.subAgentId).catch(() => undefined);

      await db.notification.create({
        data: {
          userId: subAgent.userId,
          type: "COMMISSION_CALCULATED",
          message: `Your commission for ${application.student.firstName} ${application.student.lastName} has been calculated.`,
          linkUrl: "/agent/commissions",
        },
      });

      if (subAgent.user?.email) {
        await sendResendEmail({
          to: subAgent.user.email,
          subject: "Commission calculated",
          html: `<p>Your commission for ${application.student.firstName} ${application.student.lastName} has been calculated.</p><p>Commission amount: <strong>${breakdown.agentAmount.toFixed(2)} ${application.course.currency || "GBP"}</strong></p>`,
        });
      }
    }

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "commission",
        entityId: commission.id,
        action: "stage_2_commission_calculated",
        details: `Stage 2 commission calculated for ${application.student.firstName} ${application.student.lastName}`,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        commissionId: commission.id,
        ...breakdown,
      },
    });
  } catch (error) {
    console.error("[enrolment-confirm POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
