import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateLeadScore } from "@/lib/lead-scoring";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const leadId = params.id;

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        assignedCounsellor: { select: { id: true, name: true, email: true } },
        subAgent: { select: { id: true, agencyName: true } },
        communications: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        tasks: {
          where: { status: { not: "COMPLETED" } },
          orderBy: { dueDate: "asc" },
        },
      },
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

    return NextResponse.json({ data: { lead } });
  } catch (error) {
    console.error("[/api/admin/leads/[id] GET]", error);
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

    const leadId = params.id;
    const body = await req.json();

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        communications: {
          select: { id: true },
        },
      },
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

    // Prepare updated data
    const updateData = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ? body.email.toLowerCase() : lead.email,
      phone: body.phone || lead.phone,
      nationality: body.nationality || null,
      interestedCountry: body.interestedCountry || null,
      source: body.source || lead.source,
      status: body.status || lead.status,
      notes: body.notes || null,
      campaign: body.campaign || null,
      interestedLevel: body.interestedLevel || null,
    };

    // Calculate new score
    const score = calculateLeadScore({
      email: updateData.email,
      phone: updateData.phone,
      nationality: updateData.nationality,
      campaign: updateData.campaign,
      interestedLevel: updateData.interestedLevel,
      assignedCounsellorId: body.assignedCounsellorId || lead.assignedCounsellorId,
      status: updateData.status,
      communicationCount: lead.communications.length,
    });

    const updated = await db.lead.update({
      where: { id: leadId },
      data: {
        ...updateData,
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

    return NextResponse.json({ data: { lead: updated } });
  } catch (error) {
    console.error("[/api/admin/leads/[id] PUT]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const leadId = params.id;
    const roleName = session.user.roleName;

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        assignedCounsellorId: true,
        subAgent: { select: { userId: true } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!["ADMIN", "MANAGER"].includes(roleName)) {
      return NextResponse.json({ error: "You do not have permission to delete leads." }, { status: 403 });
    }

    if (roleName === "MANAGER" && lead.assignedCounsellorId) {
      return NextResponse.json({ error: "You do not have permission to delete leads." }, { status: 403 });
    }

    // Delete related records first
    await db.communication.deleteMany({
      where: { leadId },
    });

    await db.task.deleteMany({
      where: { leadId },
    });

    await db.lead.delete({
      where: { id: leadId },
    });

    return NextResponse.json(
      { data: { message: "Lead deleted successfully" } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[/api/admin/leads/[id] DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
