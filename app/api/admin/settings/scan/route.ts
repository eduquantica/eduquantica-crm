import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

const READ_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR"]);

const bodySchema = z.object({
  plagiarismGreenMax: z.number().min(0).max(100),
  plagiarismAmberMax: z.number().min(0).max(100),
  aiGreenMax: z.number().min(0).max(100),
  aiAmberMax: z.number().min(0).max(100),
  autoApproveGreen: z.boolean(),
  autoAlertAdmin: z.boolean(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !READ_ROLES.has(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await db.scanSettings.findFirst({
      orderBy: { id: "asc" },
      select: {
        id: true,
        plagiarismGreenMax: true,
        plagiarismAmberMax: true,
        aiGreenMax: true,
        aiAmberMax: true,
        autoApproveGreen: true,
        autoAlertAdmin: true,
      },
    });

    if (!settings) {
      settings = await db.scanSettings.create({
        data: {
          plagiarismGreenMax: 15,
          plagiarismAmberMax: 30,
          aiGreenMax: 20,
          aiAmberMax: 40,
          autoApproveGreen: false,
          autoAlertAdmin: true,
        },
        select: {
          id: true,
          plagiarismGreenMax: true,
          plagiarismAmberMax: true,
          aiGreenMax: true,
          aiAmberMax: true,
          autoApproveGreen: true,
          autoAlertAdmin: true,
        },
      });
    }

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("[/api/admin/settings/scan GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.roleName !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    if (
      parsed.data.plagiarismGreenMax > parsed.data.plagiarismAmberMax ||
      parsed.data.aiGreenMax > parsed.data.aiAmberMax
    ) {
      return NextResponse.json({ error: "Green max must be less than or equal to amber max" }, { status: 400 });
    }

    const existing = await db.scanSettings.findFirst({ orderBy: { id: "asc" }, select: { id: true } });

    const settings = existing
      ? await db.scanSettings.update({
          where: { id: existing.id },
          data: parsed.data,
          select: {
            plagiarismGreenMax: true,
            plagiarismAmberMax: true,
            aiGreenMax: true,
            aiAmberMax: true,
            autoApproveGreen: true,
            autoAlertAdmin: true,
          },
        })
      : await db.scanSettings.create({
          data: parsed.data,
          select: {
            plagiarismGreenMax: true,
            plagiarismAmberMax: true,
            aiGreenMax: true,
            aiAmberMax: true,
            autoApproveGreen: true,
            autoAlertAdmin: true,
          },
        });

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("[/api/admin/settings/scan PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
