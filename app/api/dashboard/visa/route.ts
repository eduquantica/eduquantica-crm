import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma, VisaStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const country = searchParams.get("country");
    const counsellor = searchParams.get("counsellor");
    const search = searchParams.get("search");

    const where: Prisma.VisaApplicationWhereInput = {};
    if (status) where.status = status as VisaStatus;
    if (country) where.country = country;
    if (counsellor) {
      where.application = { counsellorId: counsellor };
    }
    if (search) {
      where.student = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const visas = await db.visaApplication.findMany({
      where,
      include: {
        student: true,
        application: { include: { university: true, course: true } },
      },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ data: visas });
  } catch (error) {
    console.error("Error fetching visas:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
