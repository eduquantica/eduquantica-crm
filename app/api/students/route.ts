import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.roleName;
  if (role === "STUDENT" || role === "SUB_AGENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") || "25", 10)));
    const skip = (page - 1) * pageSize;

    const [total, students] = await Promise.all([
      db.student.count(),
      db.student.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          nationality: true,
          createdAt: true,
          _count: { select: { applications: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        students,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[/api/students GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load students",
        data: {
          students: [],
          total: 0,
          page: 1,
          pageSize: 25,
          totalPages: 0,
        },
      },
      { status: 500 },
    );
  }
}
