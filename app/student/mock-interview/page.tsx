import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function StudentMockInterviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") redirect("/login");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) redirect("/login");

  const interviews = await db.mockInterview.findMany({
    where: { studentId: student.id },
    include: {
      application: {
        select: {
          id: true,
          course: {
            select: {
              name: true,
              university: {
                select: {
                  name: true,
                  country: true,
                },
              },
            },
          },
        },
      },
      report: {
        select: {
          overallScore: true,
          isPassed: true,
          recommendation: true,
          generatedAt: true,
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return (
    <main className="w-full space-y-4 px-5 py-6 sm:px-7">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-bold text-slate-900">Mock Interview</h1>
        <p className="mt-1 text-sm text-slate-600">Voice-to-text simulation only. No audio or video is stored.</p>
      </section>

      {interviews.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">No Active Interview Yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            You can still prepare now. When an interview is assigned, it will appear here automatically.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {interviews.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {row.application.course.university.name} • {row.application.course.name}
                  </p>
                  <p className="text-xs text-slate-500">{row.interviewType} • Attempt {row.attemptNumber} • Assigned {new Date(row.assignedAt).toLocaleDateString("en-GB")}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.status}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {row.status !== "COMPLETED" ? (
                  <Link href={`/student/mock-interview/${row.id}`} className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95">
                    Start / Continue
                  </Link>
                ) : (
                  <Link href={`/student/mock-interview/${row.id}/report`} className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95">
                    View Report
                  </Link>
                )}
                {row.reportDocumentUrl && (
                  <a
                    href={row.reportDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Download PDF
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Preparation Checklist</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Review your course modules, motivation, and career plan.</li>
            <li>Prepare clear answers for why this country and university fit your goals.</li>
            <li>Practice finance and accommodation answers with specific figures.</li>
            <li>Keep passport, offer details, and funding documents ready for reference.</li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Common Interview Themes</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Academic Readiness</p>
              <p className="mt-1">Course selection, prior studies, and expected workload.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Career Intent</p>
              <p className="mt-1">How the program supports your long-term professional direction.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Financial Planning</p>
              <p className="mt-1">Tuition, living costs, and verified source-of-funds clarity.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Visa Compliance</p>
              <p className="mt-1">Understanding of attendance, work limits, and immigration rules.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
