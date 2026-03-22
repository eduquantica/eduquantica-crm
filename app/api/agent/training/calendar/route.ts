import { NextResponse } from "next/server";
import { getAgentScope } from "@/lib/agent-scope";
import { db } from "@/lib/db";
import { toSubAgentOrgType } from "@/lib/training";

export async function GET() {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const trainings = await db.training.findMany({
    where: {
      organisationType: toSubAgentOrgType(scope.subAgentId),
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
