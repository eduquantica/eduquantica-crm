import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubAgentApprovalStatus } from "@prisma/client";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;

  // Optional status filter
  const statusParam = searchParams.get("status");
  const status = statusParam
    ? (statusParam.toUpperCase() as SubAgentApprovalStatus)
    : undefined;

  if (status && !Object.values(SubAgentApprovalStatus).includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid status. Must be one of: ${Object.values(SubAgentApprovalStatus).join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)),
  );
  const skip = (page - 1) * limit;

  // Optional search by agency name or user name/email
  const search = searchParams.get("search")?.trim() ?? "";

  const where = {
    ...(status ? { approvalStatus: status } : {}),
    ...(search
      ? {
          OR: [
            { agencyName: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [applications, total] = await Promise.all([
    db.subAgent.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        agencyName: true,
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
        rejectionReason: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        agreement: {
          select: {
            currentTier: true,
            currentRate: true,
            isActive: true,
            agreedDate: true,
          },
        },
        _count: {
          select: {
            infoRequests: true,
            leads: true,
            students: true,
          },
        },
      },
    }),
    db.subAgent.count({ where }),
  ]);

  return NextResponse.json({
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
