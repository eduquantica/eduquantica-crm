import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await db.checklistTemplate.findMany({
    orderBy: [{ countryName: "asc" }, { courseLevel: "asc" }],
    include: {
      items: {
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json({ data: templates });
}
