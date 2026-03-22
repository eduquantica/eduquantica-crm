import { NextRequest, NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { calculateLeadScore } from "@/lib/lead-scoring";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const search = p.get("search")?.trim() || "";
  const status = p.get("status") || "";
  const source = p.get("source") || "";
  const allocation = p.get("allocation") || "";
  const page = Math.max(1, parseInt(p.get("page") || "1", 10));

  const statusFilter = Object.values(LeadStatus).includes(status as LeadStatus) ? (status as LeadStatus) : undefined;
  const sourceFilter = Object.values(LeadSource).includes(source as LeadSource) ? (source as LeadSource) : undefined;

  const where: Prisma.LeadWhereInput = {
    subAgentId: scope.subAgentId,
    ...(scope.isBranchCounsellor ? { assignedCounsellorId: scope.userId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(!scope.isBranchCounsellor && allocation === "UNALLOCATED" ? { assignedCounsellorId: null } : {}),
    ...(!scope.isBranchCounsellor && allocation === "ME" ? { assignedCounsellorId: scope.userId } : {}),
    ...(!scope.isBranchCounsellor && allocation && allocation !== "UNALLOCATED" && allocation !== "ME" ? { assignedCounsellorId: allocation } : {}),
  };

  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        assignedCounsellor: { select: { id: true, name: true } },
      },
    }),
  ]);

  const counsellors = await db.subAgentStaff.findMany({
    where: { subAgentId: scope.subAgentId, isActive: true },
    select: { userId: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    data: {
      leads,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
      counsellors: counsellors.map((c) => ({ id: c.userId, name: c.name })),
    },
  });
}

export async function POST(req: NextRequest) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = String(body.email || "").trim().toLowerCase() || null;
    const phone = String(body.phone || "").trim() || null;
    const nationality = String(body.nationality || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const sourceInput = String(body.source || "WEBSITE").trim().toUpperCase();
    const source = Object.values(LeadSource).includes(sourceInput as LeadSource)
      ? (sourceInput as LeadSource)
      : LeadSource.WEBSITE;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }

    const score = calculateLeadScore({
      email,
      phone,
      nationality,
      status: "NEW",
      communicationCount: 0,
    });

    const created = await db.lead.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        nationality,
        notes,
        source,
        status: LeadStatus.NEW,
        subAgentId: scope.subAgentId,
        score,
      },
      include: {
        assignedCounsellor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[/api/agent/leads POST]", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
