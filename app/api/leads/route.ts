import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 25;

type Scope = {
  subAgentId: string | null;
};

async function resolveScope(userId: string, roleName: string): Promise<Scope> {
  if (roleName === "SUB_AGENT") {
    const owner = await db.subAgent.findUnique({ where: { userId }, select: { id: true } });
    return { subAgentId: owner?.id ?? null };
  }

  if (roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR") {
    const staff = await db.subAgentStaff.findUnique({
      where: { userId },
      select: { subAgentId: true },
    });
    return { subAgentId: staff?.subAgentId ?? null };
  }

  return { subAgentId: null };
}

function buildRoleWhere(roleName: string, userId: string, scope: Scope) {
  if (roleName === "ADMIN" || roleName === "MANAGER") return {};
  if (roleName === "COUNSELLOR") return { assignedCounsellorId: userId };

  if (roleName === "SUB_AGENT") {
    return {
      OR: [
        ...(scope.subAgentId ? [{ subAgentId: scope.subAgentId }] : []),
        { assignedCounsellorId: userId },
        { allocations: { some: { allocatedById: userId } } },
      ],
    };
  }

  if (roleName === "BRANCH_MANAGER") {
    if (!scope.subAgentId) return { id: "__none__" };
    return { subAgentId: scope.subAgentId };
  }

  if (roleName === "SUB_AGENT_COUNSELLOR") {
    if (!scope.subAgentId) return { id: "__none__" };
    return { subAgentId: scope.subAgentId, assignedCounsellorId: userId };
  }

  return { id: "__none__" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFilterWhere(p: URLSearchParams, roleName: string, userId: string): any {
  const isCounsellorOnly = roleName === "COUNSELLOR" || roleName === "SUB_AGENT_COUNSELLOR";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const and: any[] = [];

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

  const counsellorId = p.get("counsellorId");
  if (counsellorId && !isCounsellorOnly) and.push({ assignedCounsellorId: counsellorId });

  const allocation = p.get("allocation");
  if (allocation && !isCounsellorOnly) {
    if (allocation === "UNALLOCATED") and.push({ assignedCounsellorId: null });
    else if (allocation === "ME") and.push({ assignedCounsellorId: userId });
    else and.push({ assignedCounsellorId: allocation });
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
  score: true,
  createdAt: true,
  assignedCounsellor: { select: { id: true, name: true } },
  subAgent: { select: { id: true, agencyName: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const roleName = session.user.roleName;
  const userId = session.user.id;

  const allowed = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"]);
  if (!allowed.has(roleName)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = req.nextUrl.searchParams;

  const scope = await resolveScope(userId, roleName);
  const roleWhere = buildRoleWhere(roleName, userId, scope);
  const filterWhere = buildFilterWhere(p, roleName, userId);
  const where = { AND: [roleWhere, filterWhere] };

  if (p.get("export") === "true") {
    const leads = await db.lead.findMany({
      where,
      select: LEAD_SELECT,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const header = ["Name", "Email", "Phone", "Nationality", "Source", "Counsellor", "Sub-Agent", "Status", "Score", "Date Added"];
    const rows = leads.map((l) => [
      `${l.firstName} ${l.lastName}`,
      l.email ?? "",
      l.phone ?? "",
      l.nationality ?? "",
      l.source,
      l.assignedCounsellor?.name ?? "Unassigned",
      l.subAgent?.agencyName ?? "",
      l.status,
      String(l.score),
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
}
