import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;

  const application = await db.subAgent.findUnique({
    where: { id },
    select: {
      id: true,
      agencyName: true,
      firstName: true,
      lastName: true,
      businessEmail: true,
      agencyCountry: true,
      agencyCity: true,
      phone: true,
      website: true,
      commissionRate: true,
      isApproved: true,
      approvalStatus: true,
      approvedAt: true,
      approvedBy: true,
      rejectedAt: true,
      rejectedBy: true,
      rejectionReason: true,
      revokedAt: true,
      revokedBy: true,
      revokeReason: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          createdAt: true,
        },
      },
      agreement: {
        select: {
          id: true,
          currentTier: true,
          currentRate: true,
          silverThreshold: true,
          platinumThreshold: true,
          intakePeriod: true,
          enrolmentsThisIntake: true,
          manualTierOverride: true,
          overrideReason: true,
          isActive: true,
          agreedDate: true,
          notes: true,
          createdAt: true,
        },
      },
      infoRequests: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          adminMessage: true,
          adminAttachmentUrl: true,
          agentResponse: true,
          agentAttachmentUrl: true,
          respondedAt: true,
          createdAt: true,
          admin: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: {
          leads: true,
          students: true,
          commissions: true,
          invoices: true,
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Sub-agent application not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: application });
}
