"use client";

import Link from "next/link";

type ReportModel = {
  id: string;
  interviewType: string;
  status: string;
  assignedAt: string | Date;
  completedAt: string | Date | null;
  passingScore: number;
  overallScore: number | null;
  recommendation: string | null;
  reportDocumentUrl: string | null;
  application: {
    course: { name: string; university: { name: string; country: string } };
  };
  report: {
    overallScore: number;
    isPassed: boolean;
    recommendation: string;
    strengths: unknown;
    areasToImprove: unknown;
    inconsistenciesFound: unknown;
    detailedFeedback: string;
    fullTranscript: string;
    generatedAt: string | Date;
  } | null;
};

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export default function MockInterviewReport({ interview }: { interview: ReportModel }) {
  const strengths = asStringArray(interview.report?.strengths);
  const areas = asStringArray(interview.report?.areasToImprove);
  const inconsistencies = asStringArray(interview.report?.inconsistenciesFound);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Mock Interview Report</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{interview.application.course.university.name} • {interview.application.course.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{interview.interviewType}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Status: {interview.status}</span>
          {typeof interview.overallScore === "number" && (
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Score: {interview.overallScore.toFixed(2)}%</span>
          )}
          {interview.recommendation && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{interview.recommendation}</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Passing score</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{interview.passingScore}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Overall score</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{typeof interview.overallScore === "number" ? `${interview.overallScore.toFixed(2)}%` : "N/A"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Result</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{interview.recommendation || "Pending"}</p>
        </article>
      </div>

      {interview.report ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Top strengths</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {strengths.length ? strengths.slice(0, 3).map((row, idx) => <li key={idx}>• {row}</li>) : <li>• N/A</li>}
              </ul>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Areas to improve</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {areas.length ? areas.slice(0, 3).map((row, idx) => <li key={idx}>• {row}</li>) : <li>• N/A</li>}
              </ul>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Detailed feedback</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{interview.report.detailedFeedback}</p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Inconsistencies found</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {inconsistencies.length ? inconsistencies.map((row, idx) => <li key={idx}>• {row}</li>) : <li>• None detected</li>}
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Transcript</p>
            <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{interview.report.fullTranscript}</pre>
          </article>
        </>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Report is not generated yet.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/student/mock-interview" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Back to interviews
        </Link>
        {interview.reportDocumentUrl && (
          <a href={interview.reportDocumentUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95">
            Download PDF
          </a>
        )}
      </div>
    </section>
  );
}
