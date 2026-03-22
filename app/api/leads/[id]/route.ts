import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateLeadScore } from "@/lib/lead-scoring";

type ScopedLead = {
  id: string;
  subAgentId: string | null;
  assignedCounsellorId: string | null;
};

async function resolveScope(userId: string, roleName: string) {
  if (roleName === "SUB_AGENT") {
    const owner = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    return { subAgentId: owner?.id ?? null };
  }

  if (roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR") {
    const staff = await db.subAgentStaff.findUnique({ where: { userId }, select: { subAgentId: true } });
    return { subAgentId: staff?.subAgentId ?? null };
  }

  return { subAgentId: null };
}

function canViewLead(roleName: string, userId: string, lead: ScopedLead, subAgentId: string | null) {
  if (roleName === "ADMIN" || roleName === "MANAGER") return true;
  if (roleName === "COUNSELLOR") return lead.assignedCounsellorId === userId;
  if (roleName === "SUB_AGENT") return lead.subAgentId === subAgentId || lead.assignedCounsellorId === userId;
  if (roleName === "BRANCH_MANAGER") return subAgentId !== null && lead.subAgentId === subAgentId;
  if (roleName === "SUB_AGENT_COUNSELLOR") {
    return subAgentId !== null && lead.subAgentId === subAgentId && lead.assignedCounsellorId === userId;
  }
  return false;
}

async function getScopedLeadOr403(leadId: string, userId: string, roleName: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      subAgentId: true,
      assignedCounsellorId: true,
    },
  });

  if (!lead) return { status: 404 as const };

  const scope = await resolveScope(userId, roleName);
  const ok = canViewLead(roleName, userId, lead, scope.subAgentId);
  if (!ok) return { status: 403 as const };

  return { status: 200 as const, lead, scope };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const scoped = await getScopedLeadOr403(params.id, session.user.id, session.user.roleName);
  if (scoped.status === 404) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (scoped.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedCounsellor: { select: { id: true, name: true, email: true } },
      subAgent: { select: { id: true, agencyName: true } },
      communications: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  return NextResponse.json({ data: { lead } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const roleName = session.user.roleName;
  const canEdit = roleName === "ADMIN" || roleName === "MANAGER";
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scoped = await getScopedLeadOr403(params.id, session.user.id, roleName);
  if (scoped.status === 404) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (scoped.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: { communications: { select: { id: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const updateData = {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email ? String(body.email).toLowerCase() : lead.email,
    phone: body.phone || lead.phone,
    nationality: body.nationality || null,
    interestedCountry: body.interestedCountry || null,
    source: body.source || lead.source,
    status: body.status || lead.status,
    notes: body.notes || null,
    campaign: body.campaign || null,
    interestedLevel: body.interestedLevel || null,
  };

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
    where: { id: params.id },
    data: {
      ...updateData,
      score,
    },
    include: {
      assignedCounsellor: { select: { id: true, name: true, email: true } },
      subAgent: { select: { id: true, agencyName: true } },
      communications: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  return NextResponse.json({ data: { lead: updated } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "You do not have permission to delete leads." }, { status: 403 });
  }

  const lead = await db.lead.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await db.communication.deleteMany({ where: { leadId: params.id } });
  await db.task.deleteMany({ where: { leadId: params.id } });
  await db.lead.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { message: "Lead deleted successfully" } }, { status: 200 });
}
