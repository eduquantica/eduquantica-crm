import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type InterviewOutcome = "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED_BY_UNIVERSITY" | "NO_SHOW";

const prismaWithInterview = db as typeof db & {
  preCasInterview: {
    groupBy: (...args: unknown[]) => Promise<Array<{ outcome: InterviewOutcome | null; _count: { _all: number } }>>;
    count: (...args: unknown[]) => Promise<number>;
  };
  visaInterview: {
    groupBy: (...args: unknown[]) => Promise<Array<{ outcome: InterviewOutcome | null; _count: { _all: number } }>>;
    count: (...args: unknown[]) => Promise<number>;
  };
};

const OUTCOME_ORDER: InterviewOutcome[] = [
  "PASSED",
  "FAILED",
  "RESCHEDULED",
  "CANCELLED_BY_UNIVERSITY",
  "NO_SHOW",
];

function asOutcomeCounts(rows: Array<{ outcome: InterviewOutcome | null; _count: { _all: number } }>) {
  const map = new Map<InterviewOutcome, number>();
  for (const key of OUTCOME_ORDER) map.set(key, 0);
  for (const row of rows) {
    if (row.outcome) map.set(row.outcome, row._count._all);
  }
  return OUTCOME_ORDER.map((outcome) => ({ outcome, count: map.get(outcome) || 0 }));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [preCasRaw, visaRaw, preCasRequired, visaRequired] = await Promise.all([
    prismaWithInterview.preCasInterview.groupBy({
      by: ["outcome"],
      where: { isRequired: true, outcome: { not: null } },
      _count: { _all: true },
    }),
    prismaWithInterview.visaInterview.groupBy({
      by: ["outcome"],
      where: { isRequired: true, outcome: { not: null } },
      _count: { _all: true },
    }),
    prismaWithInterview.preCasInterview.count({ where: { isRequired: true } }),
    prismaWithInterview.visaInterview.count({ where: { isRequired: true } }),
  ]);

  const preCas = asOutcomeCounts(preCasRaw);
  const visa = asOutcomeCounts(visaRaw);

  const preCasTotal = preCas.reduce((sum, item) => sum + item.count, 0);
  const visaTotal = visa.reduce((sum, item) => sum + item.count, 0);

  const preCasPassed = preCas.find((item) => item.outcome === "PASSED")?.count || 0;
  const visaPassed = visa.find((item) => item.outcome === "PASSED")?.count || 0;

  return NextResponse.json({
    data: {
      preCas,
      visa,
      totals: {
        preCasInterviews: preCasTotal,
        visaInterviews: visaTotal,
        preCasRequired,
        visaRequired,
      },
      passRates: {
        preCas: preCasTotal > 0 ? Number(((preCasPassed / preCasTotal) * 100).toFixed(2)) : 0,
        visa: visaTotal > 0 ? Number(((visaPassed / visaTotal) * 100).toFixed(2)) : 0,
      },
    },
  });
}
