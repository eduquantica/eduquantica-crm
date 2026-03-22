import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { EDUQUANTICA_ORG_TYPE } from "@/lib/training";

function ensureTrainingViewer(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();

  const trainings = await db.training.findMany({
    where: {
      organisationType: EDUQUANTICA_ORG_TYPE,
      trainingDate: { gte: today },
    },
    include: {
      records: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: { trainingDate: "asc" },
  });

  return NextResponse.json({
    data: trainings.map((row) => ({
      id: row.id,
      name: row.name,
      trainingDate: row.trainingDate,
      deliveredBy: row.deliveredBy,
      bookedUsers: row.records.map((item) => ({
        id: item.user.id,
        name: item.user.name || item.user.email,
      })),
    })),
  });
}
