import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type FinanceStatus = "Not Started" | "In Progress" | "Funding Declared" | "Verified";

type IntakeWindow = {
  date?: string;
  deadline?: string;
};

const FINANCE_PROGRESS_ACTIONS = new Set([
  "deposit_receipt_uploaded",
  "deposit_receipt_approved",
  "bank_statement_uploaded",
  "finance_general_document_uploaded",
]);

function toIntakePeriod(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "To be confirmed";
  const first = raw[0] as IntakeWindow;
  if (!first?.date && !first?.deadline) return "To be confirmed";
  if (first?.date && first?.deadline) return `${first.date} • Deadline: ${first.deadline}`;
  return first?.date || `Deadline: ${first?.deadline}`;
}

function resolveFinanceStatus(actions: Set<string>): FinanceStatus {
  if (actions.has("bank_statement_approved")) return "Verified";
  if (actions.has("funding_sources_updated")) return "Funding Declared";
  if (Array.from(actions).some((action) => FINANCE_PROGRESS_ACTIONS.has(action))) return "In Progress";
  return "Not Started";
}

function financeStatusBadgeClass(status: FinanceStatus): string {
  if (status === "Verified") return "bg-emerald-100 text-emerald-700";
  if (status === "Funding Declared") return "bg-blue-100 text-blue-700";
  if (status === "In Progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function StudentFinancePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return <div className="text-sm text-red-600">Unauthorized</div>;
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
    },
  });

  if (!student) {
    return <div className="text-sm text-red-600">Student profile not found</div>;
  }

  const applications = await db.application.findMany({
    where: {
      studentId: student.id,
      offerReceivedAt: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      course: {
        select: {
          name: true,
          intakeDatesWithDeadlines: true,
          university: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const applicationIds = applications.map((application) => application.id);

  const logs = applicationIds.length
    ? await db.activityLog.findMany({
        where: {
          entityType: "application",
          entityId: { in: applicationIds },
          action: {
            in: [
              "funding_sources_updated",
              "bank_statement_approved",
              "bank_statement_uploaded",
              "deposit_receipt_uploaded",
              "deposit_receipt_approved",
              "finance_general_document_uploaded",
            ],
          },
        },
        select: {
          entityId: true,
          action: true,
        },
      })
    : [];

  const actionsByApplication = new Map<string, Set<string>>();
  for (const entry of logs) {
    const existing = actionsByApplication.get(entry.entityId) || new Set<string>();
    existing.add(entry.action);
    actionsByApplication.set(entry.entityId, existing);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">Finance</h1>
        <p className="mt-1 text-sm text-slate-600">Manage finance requirements for applications with an offer letter.</p>
      </section>

      {applications.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">Your finance section will appear here once you receive an offer letter.</p>
          <Link
            href="/student/courses"
            className="mt-5 inline-flex items-center rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Browse Courses
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          {applications.map((application) => {
            const status = resolveFinanceStatus(actionsByApplication.get(application.id) || new Set<string>());

            return (
              <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{application.course.university.name}</p>
                    <p className="text-sm text-slate-700">{application.course.name}</p>
                    <p className="mt-1 text-xs text-slate-500">Intake: {toIntakePeriod(application.course.intakeDatesWithDeadlines)}</p>
                  </div>

                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${financeStatusBadgeClass(status)}`}>
                    {status}
                  </span>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/student/finance/${application.id}`}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Finance Details
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
