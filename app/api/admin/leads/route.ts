import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

const LEAD_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  nationality: true,
  source: true,
  status: true,
  createdAt: true,
  notes: true,
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

      const header = ["Name", "Email", "Phone", "Nationality", "Source", "Counsellor", "Sub-Agent", "Status", "Date Added"];
      const rows = leads.map((l) => [
        `${l.firstName} ${l.lastName}`,
        l.email ?? "",
        l.phone ?? "",
        l.nationality ?? "",
        l.source,
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

    const [total, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        select: LEAD_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

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
