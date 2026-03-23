import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ServiceCommStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(ServiceCommStatus),
  notes: z.string().trim().optional().nullable(),
});

function canManage(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const commissions = await db.serviceCommission.findMany({
      include: {
        provider: { select: { id: true, name: true } },
        serviceApp: {
          include: {
            listing: { select: { id: true, title: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const studentIds = Array.from(new Set(commissions.map((item) => item.serviceApp.studentId)));
    const students = studentIds.length
      ? await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const studentMap = new Map(students.map((student) => [student.id, `${student.firstName} ${student.lastName}`]));

    const monthFloor = monthStart(new Date());
    const data = commissions.map((item) => ({
      id: item.id,
      provider: item.provider,
      studentName: studentMap.get(item.serviceApp.studentId) || item.serviceApp.studentId,
      amount: item.amount,
      currency: item.currency,
      rate: item.rate,
      status: item.status,
      invoicedAt: item.invoicedAt,
      paidAt: item.paidAt,
      notes: item.notes,
      serviceAppId: item.serviceAppId,
      listingTitle: item.serviceApp.listing.title,
      type: item.serviceApp.listing.type,
      createdAt: item.createdAt,
    }));

    const summary = {
      totalEarned: data.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0),
      pending: data.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + item.amount, 0),
      invoiced: data.filter((item) => item.status === "INVOICED").reduce((sum, item) => sum + item.amount, 0),
      thisMonthEarned: data
        .filter((item) => item.status === "PAID" && item.paidAt && new Date(item.paidAt) >= monthFloor)
        .reduce((sum, item) => sum + item.amount, 0),
    };

    return NextResponse.json({ data, summary });
  } catch (error) {
    console.error("[GET /api/admin/service-commissions]", error);
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

    const now = new Date();
    const item = await db.serviceCommission.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes,
        invoicedAt: parsed.data.status === "INVOICED" ? now : undefined,
        paidAt: parsed.data.status === "PAID" ? now : undefined,
      },
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("[PATCH /api/admin/service-commissions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}