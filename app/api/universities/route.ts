import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.roleName;
  if (role === "STUDENT" || role === "SUB_AGENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const universities = await db.university.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        currency: true,
      },
    });

    // Compatibility endpoint consumed by older UI code paths.
    return NextResponse.json(universities);
  } catch (error) {
    console.error("[/api/universities GET]", error);
    return NextResponse.json([], { status: 500 });
  }
}
