import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ProviderType, ServiceAppStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(ServiceAppStatus),
  adminNote: z.string().trim().optional().nullable(),
  placementConfirmed: z.boolean().optional(),
});

function canRead(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canRead(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || "";
    const type = request.nextUrl.searchParams.get("type") || "";
    const providerId = request.nextUrl.searchParams.get("providerId") || "";
    const studentSearch = request.nextUrl.searchParams.get("studentSearch")?.trim().toLowerCase() || "";

    const applications = await db.serviceApplication.findMany({
      where: {
        ...(status && Object.values(ServiceAppStatus).includes(status as ServiceAppStatus) ? { status: status as ServiceAppStatus } : {}),
        ...(providerId ? { listing: { providerId } } : {}),
        ...(type && Object.values(ProviderType).includes(type as ProviderType) ? { listing: { type: type as ProviderType } } : {}),
      },
      include: {
        listing: {
          include: {
            provider: { select: { id: true, name: true, type: true } },
          },
        },
        commission: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const studentIds = Array.from(new Set(applications.map((item) => item.studentId)));
    const students = studentIds.length
      ? await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const studentMap = new Map(students.map((student) => [student.id, student]));

    const rows = applications
      .map((item) => {
        const student = studentMap.get(item.studentId);
        const studentName = student ? `${student.firstName} ${student.lastName}` : item.studentId;
        return {
          id: item.id,
          studentId: item.studentId,
          studentName,
          studentEmail: student?.email || null,
          listingTitle: item.listing.title,
          providerName: item.listing.provider.name,
          providerId: item.listing.provider.id,
          type: item.listing.type,
          status: item.status,
          appliedDate: item.createdAt,
          placementConfirmed: item.placementConfirmed,
          placementDate: item.placementDate,
          commissionEarned: item.commissionEarned,
          studentNote: item.studentNote,
          adminNote: item.adminNote,
          listing: {
            id: item.listing.id,
            city: item.listing.city,
            country: item.listing.country,
            price: item.listing.price,
            currency: item.listing.currency,
          },
          commission: item.commission,
        };
      })
      .filter((item) => {
        if (!studentSearch) return true;
        return item.studentName.toLowerCase().includes(studentSearch) || (item.studentEmail || "").toLowerCase().includes(studentSearch);
      });

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("[GET /api/admin/service-applications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const data = parsed.data;
    const item = await db.serviceApplication.update({
      where: { id: data.id },
      data: {
        status: data.status,
        adminNote: data.adminNote,
        ...(data.placementConfirmed !== undefined
          ? {
              placementConfirmed: data.placementConfirmed,
              placementDate: data.placementConfirmed ? new Date() : null,
            }
          : {}),
      },
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("[PATCH /api/admin/service-applications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}