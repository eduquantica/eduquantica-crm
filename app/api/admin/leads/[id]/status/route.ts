import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateLeadScore } from "@/lib/lead-scoring";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const leadId = params.id;
    const body = await req.json();

    const lead = await db.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // For counsellors, check they own the lead
    if (session.user.roleName === "COUNSELLOR") {
      if (lead.assignedCounsellorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get communication count
    const commCount = await db.communication.count({ where: { leadId } });

    // Calculate new score with updated status
    const score = calculateLeadScore({
      email: lead.email,
      phone: lead.phone,
      nationality: lead.nationality,
      campaign: lead.campaign,
      interestedLevel: lead.interestedLevel,
      assignedCounsellorId: lead.assignedCounsellorId,
      status: body.status,
      communicationCount: commCount,
    });

    // Update status
    const updated = await db.lead.update({
      where: { id: leadId },
      data: {
        status: body.status,
        score,
      },
      include: {
        assignedCounsellor: { select: { id: true, name: true } },
        subAgent: { select: { id: true, agencyName: true } },
        communications: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
        tasks: true,
      },
    });

    // Log status change
    await db.communication.create({
      data: {
        leadId,
        userId: session.user.id,
        type: "NOTE",
        message: `Status changed to ${body.status}`,
        direction: "OUTBOUND",
      },
    });

    return NextResponse.json({ data: { lead: updated } });
  } catch (error) {
    console.error("[/api/admin/leads/[id]/status POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
