import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { calculateLeadScore } from "@/lib/lead-scoring";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    // Check permission
    if (!checkPermission(session, "leads", "canCreate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      nationality,
      countryOfResidence,
      source,
      preferredDestination,
      interestedIn,
      notes,
      assignedCounsellorId,
      subAgentId,
    } = body;

    // Validation
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: "First and last name are required" },
        { status: 400 }
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!phone?.trim()) {
      return NextResponse.json(
        { error: "Phone is required" },
        { status: 400 }
      );
    }

    if (!source) {
      return NextResponse.json(
        { error: "Source is required" },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingLead = await db.lead.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingLead) {
      return NextResponse.json(
        { error: "A lead with this email already exists" },
        { status: 409 }
      );
    }

    // Create lead
    const leadData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      nationality: nationality || null,
      interestedCountry: countryOfResidence || null,
      interestedLevel: interestedIn || null,
      notes: notes || null,
      source,
      status: "NEW" as const,
      assignedCounsellorId: assignedCounsellorId || null,
      subAgentId: subAgentId || null,
      campaign: preferredDestination || null,
    };

    // Calculate score
    const score = calculateLeadScore({
      email: leadData.email,
      phone: leadData.phone,
      nationality: leadData.nationality,
      campaign: leadData.campaign,
      interestedLevel: leadData.interestedLevel,
      assignedCounsellorId: leadData.assignedCounsellorId,
      status: leadData.status,
      communicationCount: 0, // New lead has no communications yet
    });

    const lead = await db.lead.create({
      data: {
        ...leadData,
        score,
      },
      include: {
        assignedCounsellor: { select: { id: true, name: true } },
        subAgent: { select: { id: true, agencyName: true } },
      },
    });

    return NextResponse.json({ data: { lead } }, { status: 201 });
  } catch (error) {
    console.error("[/api/admin/leads POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
