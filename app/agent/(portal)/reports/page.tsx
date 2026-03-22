import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAgentScope, getAgentStudentWhere } from "@/lib/agent-scope";
import AgentReportsClient, { type AgentMockInterviewDetailRow, type AgentMockInterviewMonthlyRow } from "./AgentReportsClient";

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

type InterviewRow = {
  id: string;
  interviewType: string;
  completedAt: Date | null;
  reportDocumentUrl: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    subAgent?: {
      user?: {
        name?: string | null;
      } | null;
    } | null;
  };
  application: {
    course: {
      name: string;
      university: {
        name: string;
      };
    };
  };
  report: {
    overallScore: number;
    isPassed: boolean;
    recommendation: string;
  } | null;
};

export default async function AgentReportsPage() {
  const scope = await getAgentScope();
  if (!scope) redirect("/login");

  // Compatibility cast for environments where Prisma client typings lag behind restored portal code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;

  const rowsRaw = (await dbAny.mockInterview.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { not: null },
      report: { isNot: null },
      student: getAgentStudentWhere(scope),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          subAgent: {
            select: {
              user: { select: { name: true } },
            },
          },
        },
      },
      application: {
        select: {
          course: {
            select: {
              name: true,
              university: { select: { name: true } },
            },
          },
        },
      },
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
        },
      },
    },
    orderBy: [{ completedAt: "desc" }],
  })) as InterviewRow[];

  const details: AgentMockInterviewDetailRow[] = rowsRaw
    .filter((row: InterviewRow) => !!row.completedAt && !!row.report)
    .map((row: InterviewRow) => ({
      interviewId: row.id,
      studentId: row.student.id,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      university: row.application.course.university.name,
      course: row.application.course.name,
      interviewType: row.interviewType,
      counsellor: row.student.subAgent?.user?.name || null,
      completedAt: row.completedAt!.toISOString(),
      overallScore: row.report!.overallScore,
      isPassed: row.report!.isPassed,
      recommendation: row.report!.recommendation,
      reportDocumentUrl: row.reportDocumentUrl,
    }));

  const monthlyMap = new Map<string, { completed: number; passed: number; failed: number }>();
  for (const row of details) {
    const month = row.completedAt.slice(0, 7);
    const agg = monthlyMap.get(month) || { completed: 0, passed: 0, failed: 0 };
    agg.completed += 1;
    if (row.isPassed) agg.passed += 1;
    else agg.failed += 1;
    monthlyMap.set(month, agg);
  }

  const monthlyRows: AgentMockInterviewMonthlyRow[] = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, agg]) => ({
      month,
      completed: agg.completed,
      passed: agg.passed,
      failed: agg.failed,
      passRate: agg.completed > 0 ? roundToTwo((agg.passed / agg.completed) * 100) : 0,
    }));

  return <AgentReportsClient details={details} monthlyRows={monthlyRows} />;
}
