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

    // Create communication log
    const communication = await db.communication.create({
      data: {
        leadId,
        userId: session.user.id,
        type: body.type || "NOTE",
        subject: body.subject || null,
        message: body.message,
        direction: body.direction || "INBOUND",
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Recalculate lead score (now that communication count has increased)
    const commCount = await db.communication.count({ where: { leadId } });
    const newScore = calculateLeadScore({
      email: lead.email,
      phone: lead.phone,
      nationality: lead.nationality,
      campaign: lead.campaign,
      interestedLevel: lead.interestedLevel,
      assignedCounsellorId: lead.assignedCounsellorId,
      status: lead.status,
      communicationCount: commCount,
    });

    // Update lead score
    await db.lead.update({
      where: { id: leadId },
      data: { score: newScore },
    });

    return NextResponse.json(
      { data: { communication } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[/api/admin/leads/[id]/communications POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
