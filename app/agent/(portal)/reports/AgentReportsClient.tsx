"use client";

import { useMemo, useState } from "react";

export interface AgentMockInterviewMonthlyRow {
  month: string;
  completed: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface AgentMockInterviewDetailRow {
  interviewId: string;
  studentId: string;
  studentName: string;
  university: string;
  course: string;
  interviewType: string;
  counsellor: string | null;
  completedAt: string;
  overallScore: number;
  isPassed: boolean;
  recommendation: string;
  reportDocumentUrl: string | null;
}

function formatDate(dateIso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}

export default function AgentReportsClient({
  details,
  monthlyRows,
}: {
  details: AgentMockInterviewDetailRow[];
  monthlyRows: AgentMockInterviewMonthlyRow[];
}) {
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [counsellorFilter, setCounsellorFilter] = useState<string>("ALL");
  const [resultFilter, setResultFilter] = useState<"ALL" | "PASS" | "FAIL">("ALL");

  const monthOptions = useMemo(
    () => Array.from(new Set(details.map((row) => row.completedAt.slice(0, 7)))).sort().reverse(),
    [details],
  );

  const counsellorOptions = useMemo(
    () => Array.from(new Set(details.map((row) => row.counsellor).filter((x): x is string => !!x))),
    [details],
  );

  const filteredRows = useMemo(() => {
    return details.filter((row) => {
      if (monthFilter !== "ALL" && row.completedAt.slice(0, 7) !== monthFilter) return false;
      if (counsellorFilter !== "ALL" && (row.counsellor || "") !== counsellorFilter) return false;
      if (resultFilter === "PASS" && !row.isPassed) return false;
      if (resultFilter === "FAIL" && row.isPassed) return false;
      return true;
    });
  }, [details, monthFilter, counsellorFilter, resultFilter]);

  const cards = useMemo(() => {
    const total = filteredRows.length;
    const passed = filteredRows.filter((row) => row.isPassed).length;
    const failed = total - passed;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    return { total, passRate, failed };
  }, [filteredRows]);

  function exportCsv() {
    const header = ["Student Name", "University", "Course", "Interview Type", "Completed At", "Score", "Result", "Counsellor"];
    const rows = filteredRows.map((row) => [
      row.studentName,
      row.university,
      row.course,
      row.interviewType,
      formatDate(row.completedAt),
      row.overallScore.toFixed(2),
      row.isPassed ? "PASS" : "FAIL",
      row.counsellor || "-",
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-mock-interviews-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-600">Mock interview reporting scoped to your students.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-600">Completed This Period</p><p className="text-2xl font-bold text-slate-900">{cards.total}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-600">Pass Rate</p><p className="text-2xl font-bold text-slate-900">{cards.passRate.toFixed(2)}%</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-600">Students Needing Support</p><p className="text-2xl font-bold text-slate-900">{cards.failed}</p></div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Monthly Summary</h2>
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Month</th>
              <th className="py-2 pr-4">Completed</th>
              <th className="py-2 pr-4">Passed</th>
              <th className="py-2 pr-4">Failed</th>
              <th className="py-2">Pass Rate</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map((row) => (
              <tr key={row.month} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{row.month}</td>
                <td className="py-2 pr-4">{row.completed}</td>
                <td className="py-2 pr-4">{row.passed}</td>
                <td className="py-2 pr-4">{row.failed}</td>
                <td className="py-2">{row.passRate.toFixed(2)}%</td>
              </tr>
            ))}
            {monthlyRows.length === 0 && <tr><td colSpan={5} className="py-4 text-slate-500">No monthly data available.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Per-Student Detail</h2>
          <button onClick={exportCsv} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Export CSV</button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="ALL">All Months</option>
            {monthOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={counsellorFilter} onChange={(e) => setCounsellorFilter(e.target.value)}>
            <option value="ALL">All Counsellors</option>
            {counsellorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={resultFilter} onChange={(e) => setResultFilter(e.target.value as "ALL" | "PASS" | "FAIL")}>
            <option value="ALL">All Results</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">University</th>
                <th className="py-2 pr-4">Course</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Completed</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Result</th>
                <th className="py-2 pr-4">Counsellor</th>
                <th className="py-2 text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.interviewId} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{row.studentName}</td>
                  <td className="py-2 pr-4">{row.university}</td>
                  <td className="py-2 pr-4">{row.course}</td>
                  <td className="py-2 pr-4">{row.interviewType}</td>
                  <td className="py-2 pr-4">{formatDate(row.completedAt)}</td>
                  <td className="py-2 pr-4">{row.overallScore.toFixed(2)}%</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {row.isPassed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{row.counsellor || "-"}</td>
                  <td className="py-2 text-right">{row.reportDocumentUrl ? <a href={row.reportDocumentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a> : "-"}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && <tr><td colSpan={9} className="py-4 text-slate-500">No mock interview records found for selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
