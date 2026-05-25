import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

function staffGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const r = session.user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// Build a Prisma-compatible where clause from request params + role context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWhere(roleName: string, userId: string, p: URLSearchParams, branchSubAgentId: string | null): any {
  const isCounsellor = roleName === "COUNSELLOR";
  const isBranchManager = roleName === "BRANCH_MANAGER";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const and: any[] = [];

  // Role gate: counsellors only see their own assigned leads
  if (isCounsellor) and.push({ assignedCounsellorId: userId });
  // Branch managers see leads from their own agency/branch only.
  if (isBranchManager && branchSubAgentId) and.push({ subAgentId: branchSubAgentId });

  const search = p.get("search")?.trim();
  if (search) {
    and.push({
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const status = p.get("status");
  if (status) and.push({ status });

  const source = p.get("source");
  if (source) and.push({ source });

  // Counsellor filter only available to non-counsellor roles
  const counsellorId = p.get("counsellorId");
  if (counsellorId && !isCounsellor) and.push({ assignedCounsellorId: counsellorId });

  const allocation = p.get("allocation");
  if (!isCounsellor && allocation) {
    if (allocation === "UNALLOCATED") {
      and.push({ assignedCounsellorId: null });
    } else if (allocation === "ME") {
      and.push({ assignedCounsellorId: userId });
    } else {
      and.push({ assignedCounsellorId: allocation });
    }
  }

  const subAgentId = p.get("subAgentId");
  if (subAgentId) and.push({ subAgentId });

  const qualification = p.get("qualification");
  if (qualification) and.push({ lastAcademicQualification: qualification });

  const ielts = p.get("ielts");
  if (ielts === "yes") and.push({ hasIelts: true });
  if (ielts === "no")  and.push({ hasIelts: false });

  const from = p.get("from");
  if (from) and.push({ createdAt: { gte: new Date(from) } });

  const to = p.get("to");
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: toDate } });
  }

  return and.length > 0 ? { AND: and } : {};
}

interface LeadRaw {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  source: string;
  status: string;
  score: number;
  createdAt: Date;
  notes: string | null;
  lastAcademicQualification: string | null;
  hasIelts: boolean | null;
  assignedCounsellorId: string | null;
  counsellorName: string | null;
  subAgentId: string | null;
  agencyName: string | null;
  communicationsCount: number | bigint;
}

function buildRawConditions(
  roleName: string,
  userId: string,
  p: URLSearchParams,
  branchSubAgentId: string | null,
): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [];

  if (roleName === "COUNSELLOR") conds.push(Prisma.sql`l."assignedCounsellorId" = ${userId}`);
  if (roleName === "BRANCH_MANAGER" && branchSubAgentId) conds.push(Prisma.sql`l."subAgentId" = ${branchSubAgentId}`);

  const search = p.get("search")?.trim();
  if (search) {
    const like = `%${search}%`;
    conds.push(Prisma.sql`(l."firstName" ILIKE ${like} OR l."lastName" ILIKE ${like} OR l.email ILIKE ${like} OR l.phone ILIKE ${like})`);
  }

  const status = p.get("status");
  if (status) conds.push(Prisma.sql`l.status::text = ${status}`);

  const source = p.get("source");
  if (source) conds.push(Prisma.sql`l.source::text = ${source}`);

  const counsellorId = p.get("counsellorId");
  if (counsellorId && roleName !== "COUNSELLOR") conds.push(Prisma.sql`l."assignedCounsellorId" = ${counsellorId}`);

  const allocation = p.get("allocation");
  if (allocation && roleName !== "COUNSELLOR") {
    if (allocation === "UNALLOCATED") conds.push(Prisma.sql`l."assignedCounsellorId" IS NULL`);
    else if (allocation === "ME") conds.push(Prisma.sql`l."assignedCounsellorId" = ${userId}`);
    else conds.push(Prisma.sql`l."assignedCounsellorId" = ${allocation}`);
  }

  const subAgentId = p.get("subAgentId");
  if (subAgentId) conds.push(Prisma.sql`l."subAgentId" = ${subAgentId}`);

  const qualification = p.get("qualification");
  if (qualification) conds.push(Prisma.sql`l."lastAcademicQualification" = ${qualification}`);

  const ielts = p.get("ielts");
  if (ielts === "yes") conds.push(Prisma.sql`l."hasIelts" = true`);
  if (ielts === "no")  conds.push(Prisma.sql`l."hasIelts" = false`);

  const from = p.get("from");
  if (from) conds.push(Prisma.sql`l."createdAt" >= ${new Date(from)}`);

  const to = p.get("to");
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conds.push(Prisma.sql`l."createdAt" <= ${toDate}`);
  }

  return conds;
}

const LEAD_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  nationality: true,
  source: true,
  status: true,
  score: true,
  createdAt: true,
  notes: true,
  lastAcademicQualification: true,
  hasIelts: true,
  assignedCounsellor: { select: { id: true, name: true } },
  subAgent: { select: { id: true, agencyName: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  const p = req.nextUrl.searchParams;

  try {
    const roleName = session!.user.roleName;
    const userId = session!.user.id;
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        subAgent: { select: { id: true } },
        subAgentStaff: { select: { subAgentId: true } },
      },
    });
    const branchSubAgentId = currentUser?.subAgent?.id || currentUser?.subAgentStaff?.subAgentId || null;

    const where = buildWhere(roleName, userId, p, branchSubAgentId);

    // ── CSV Export ─────────────────────────────────────────────────────────────
    if (p.get("export") === "true") {
      const leads = await db.lead.findMany({
        where,
        select: LEAD_SELECT,
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      const header = ["Name", "Email", "Phone", "Nationality", "Source", "Qualification", "Has IELTS", "Counsellor", "Sub-Agent", "Status", "Date Added"];
      const rows = leads.map((l) => [
        `${l.firstName} ${l.lastName}`,
        l.email ?? "",
        l.phone ?? "",
        l.nationality ?? "",
        l.source,
        l.lastAcademicQualification ?? "",
        l.hasIelts === true ? "Yes" : l.hasIelts === false ? "No" : "",
        l.assignedCounsellor?.name ?? "Unassigned",
        l.subAgent?.agencyName ?? "",
        l.status,
        new Date(l.createdAt).toLocaleDateString("en-GB"),
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // ── Paginated list ─────────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    const rawConds = buildRawConditions(roleName, userId, p, branchSubAgentId);
    const whereClause = rawConds.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(rawConds, " AND ")}`
      : Prisma.empty;

    const [total, rawLeads] = await Promise.all([
      db.lead.count({ where }),
      db.$queryRaw<LeadRaw[]>(Prisma.sql`
        SELECT
          l.id,
          l."firstName",
          l."lastName",
          l.email,
          l.phone,
          l.nationality,
          l.source::text  AS source,
          l.status::text  AS status,
          l.score,
          l."createdAt",
          l.notes,
          l."lastAcademicQualification",
          l."hasIelts",
          l."assignedCounsellorId",
          u.name          AS "counsellorName",
          l."subAgentId",
          sa."agencyName",
          (SELECT COUNT(*)::int FROM "Communication" c WHERE c."leadId" = l.id) AS "communicationsCount"
        FROM "Lead" l
        LEFT JOIN "User" u  ON u.id  = l."assignedCounsellorId"
        LEFT JOIN "SubAgent" sa ON sa.id = l."subAgentId"
        ${whereClause}
        ORDER BY
          CASE
            WHEN l.status::text = 'NEW' AND l."assignedCounsellorId" IS NULL THEN 0
            WHEN l.status::text = 'NEW'                                       THEN 1
            ELSE 2
          END ASC,
          l."createdAt" DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `),
    ]);

    const leads = rawLeads.map((l) => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      phone: l.phone,
      nationality: l.nationality,
      source: l.source,
      status: l.status,
      score: l.score,
      createdAt: l.createdAt.toISOString(),
      notes: l.notes,
      lastAcademicQualification: l.lastAcademicQualification,
      hasIelts: l.hasIelts,
      communicationsCount: Number(l.communicationsCount),
      assignedCounsellor: l.assignedCounsellorId
        ? { id: l.assignedCounsellorId, name: l.counsellorName }
        : null,
      subAgent: l.subAgentId
        ? { id: l.subAgentId, agencyName: l.agencyName }
        : null,
    }));

    return NextResponse.json({
      data: {
        leads,
        total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (error) {
    console.error("[/api/admin/leads GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load leads",
        data: {
          leads: [],
          total: 0,
          page: 1,
          pageSize: PAGE_SIZE,
          totalPages: 0,
        },
      },
      { status: 500 },
    );
  }
}
