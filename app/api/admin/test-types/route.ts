import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().trim().min(1, "Test type name is required"),
  isIELTS: z.boolean().default(false),
});

function isAdminEditor(roleName: string | undefined) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.testType.findMany({
    where: { isActive: true },
    orderBy: [{ isIELTS: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminEditor(session.user.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = createSchema.parse(await req.json());
    const created = await db.testType.create({
      data: {
        name: payload.name,
        isIELTS: payload.isIELTS,
        isActive: true,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create test type" }, { status: 500 });
  }
}
