"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import RecruitmentFunnelSection from "@/components/RecruitmentFunnelSection";
import MyPerformanceCard from "@/components/MyPerformanceCard";
import InterviewOverviewSection from "@/components/InterviewOverviewSection";

type DashboardPayload = {
  stats: {
    isBranchCounsellor: boolean;
    canViewFinancials?: boolean;
    referral: {
      referralCode: string | null;
      referralUrl: string | null;
      registrations: number;
      agencyName: string | null;
    };
    cards: {
      myStudents: number;
      activeApplications: number;
      totalApplications: number;
      avgApplicationsPerStudent: number;
      enrolledThisYear: number;
      pendingCommissions: { gbp: number; dualCurrency: string; dualAmount: number };
      paidCommissions: { gbp: number; dualCurrency: string; dualAmount: number };
      conversionRate: number;
    };
  };
  pipeline: Array<{ key: string; label: string; count: number; href: string; color: string }>;
  recentStudents: Array<{
    id: string;
    studentName: string;
    nationality: string | null;
    courseName: string;
    universityName: string;
    applicationStatus: string;
    pipelineStage: string;
    assignedCounsellorName: string;
    branchCounsellorName: string;
    lastUpdatedAt: string;
    href: string;
  }>;
  commissions: {
    expected: number;
    pendingInvoice: number;
    paidYtd: number;
    currency: string;
    recentPayouts: Array<{ id: string; studentName: string; amount: number; currency: string; paidAt: string; href: string }>;
  };
  counsellors: {
    teamSize: number;
    unassignedStudents: number;
    counsellors: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      studentsCount: number;
      activeApplications: number;
      enrolledThisYear: number;
      conversionRate: number;
      isActive: boolean;
    }>;
  };
  activity: Array<{
    id: string;
    title: string;
    description: string | null;
    actorName: string;
    createdAt: string;
    studentId: string | null;
    href: string | null;
  }>;
};

type MockInterviewSummary = {
  completed: number;
  passRate: number;
  needingSupport: number;
};

type AgentPLWidget = {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
};

const EMPTY_PAYLOAD: DashboardPayload = {
  stats: {
    isBranchCounsellor: false,
    canViewFinancials: true,
    referral: {
      referralCode: null,
      referralUrl: null,
      registrations: 0,
      agencyName: null,
    },
    cards: {
      myStudents: 0,
      activeApplications: 0,
      totalApplications: 0,
      avgApplicationsPerStudent: 0,
      enrolledThisYear: 0,
      pendingCommissions: { gbp: 0, dualCurrency: "GBP", dualAmount: 0 },
      paidCommissions: { gbp: 0, dualCurrency: "GBP", dualAmount: 0 },
      conversionRate: 0,
    },
  },
  pipeline: [],
  recentStudents: [],
  commissions: {
    expected: 0,
    pendingInvoice: 0,
    paidYtd: 0,
    currency: "GBP",
    recentPayouts: [],
  },
  counsellors: {
    teamSize: 0,
    unassignedStudents: 0,
    counsellors: [],
  },
  activity: [],
};

function toFlag(country: string | null) {
  if (!country || country.length !== 2) return "🌍";
  const code = country.toUpperCase();
  const first = code.charCodeAt(0) - 65 + 0x1f1e6;
  const second = code.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
}

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function AgentDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [mockInterviewSummary, setMockInterviewSummary] = useState<MockInterviewSummary | null>(null);
  const [plWidget, setPlWidget] = useState<AgentPLWidget | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, pipelineRes, recentRes, commissionsRes, counsellorsRes, activityRes, mockSummaryRes, plRes] = await Promise.all([
          fetch("/api/agent/dashboard/stats", { cache: "no-store" }),
          fetch("/api/agent/dashboard/pipeline", { cache: "no-store" }),
          fetch("/api/agent/dashboard/recent-students", { cache: "no-store" }),
          fetch("/api/agent/dashboard/commissions", { cache: "no-store" }),
          fetch("/api/agent/dashboard/counsellors", { cache: "no-store" }),
          fetch("/api/agent/dashboard/activity", { cache: "no-store" }),
          fetch("/api/agent/dashboard/mock-interview-summary", { cache: "no-store" }),
          fetch(`/api/pl/summary?year=${new Date().getUTCFullYear()}&month=${new Date().getUTCMonth() + 1}`, { cache: "no-store" }),
        ]);

        const [statsJson, pipelineJson, recentJson, commissionsJson, counsellorsJson, activityJson, mockSummaryJson, plJson] = await Promise.all([
          statsRes.json(),
          pipelineRes.json(),
          recentRes.json(),
          commissionsRes.json(),
          counsellorsRes.json(),
          activityRes.json(),
          mockSummaryRes.json(),
          plRes.json(),
        ]);

        if (
          !statsRes.ok ||
          !pipelineRes.ok ||
          !recentRes.ok ||
          !commissionsRes.ok ||
          !counsellorsRes.ok ||
          !activityRes.ok ||
          !mockSummaryRes.ok ||
          !plRes.ok
        ) {
          throw new Error("Failed to load dashboard");
        }

        if (!active) return;
        setPayload({
          stats: statsJson.data,
          pipeline: pipelineJson.data,
          recentStudents: recentJson.data,
          commissions: commissionsJson.data,
          counsellors: counsellorsJson.data,
          activity: activityJson.data,
        });
        setMockInterviewSummary(mockSummaryJson.data);
        setPlWidget({
          totalIncome: plJson.data?.summary?.totalIncome || 0,
          totalExpenses: plJson.data?.summary?.totalExpenses || 0,
          netProfit: plJson.data?.summary?.netProfit || 0,
        });
      } catch {
        if (active) {
          setError("Unable to load dashboard right now.");
          setPayload(EMPTY_PAYLOAD);
          setMockInterviewSummary({ completed: 0, passRate: 0, needingSupport: 0 });
          setPlWidget({ totalIncome: 0, totalExpenses: 0, netProfit: 0 });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (!payload) return [] as Array<{ label: string; value: string; href?: string; tooltip?: string }>;
    const baseCards = [
      {
        label: "Total Students",
        value: String(payload.stats.cards.myStudents),
        href: "/agent/students",
        tooltip: "Number of unique students in the system. One student can have multiple applications.",
      },
      {
        label: "Total Applications",
        value: String(payload.stats.cards.totalApplications),
        href: "/agent/applications",
        tooltip: "Total number of applications submitted. One student may have up to 5 applications.",
      },
      {
        label: "Average Applications per Student",
        value: payload.stats.cards.avgApplicationsPerStudent.toFixed(2),
        tooltip: "Average applications per student (total applications / total students).",
      },
      { label: "Active Applications", value: String(payload.stats.cards.activeApplications), href: "/agent/applications" },
      { label: "Enrolled This Year", value: String(payload.stats.cards.enrolledThisYear), href: "/agent/applications?status=ENROLLED" },
      { label: "Conversion Rate", value: `${payload.stats.cards.conversionRate}%` },
    ];
    if (payload.stats.canViewFinancials) {
      baseCards.splice(5, 0,
        {
          label: "Pending Commissions",
          value: formatMoney(payload.stats.cards.pendingCommissions.gbp, "GBP"),
          href: "/agent/commissions",
        },
        {
          label: "Paid Commissions",
          value: formatMoney(payload.stats.cards.paidCommissions.gbp, "GBP"),
          href: "/agent/commissions",
        },
      );
    }
    return baseCards;
  }, [payload]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading dashboard...</div>;
  }

  if (!payload) {
    return <div className="p-6 text-sm text-red-600">{error || "Unable to load dashboard."}</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {error} Showing available data.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Dashboard</h1>
          <p className="text-sm text-slate-600">Overview of student progress, applications, commissions, and team activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/agent/students" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Add Student</Link>
          <Link href="/agent/applications" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">My Applications</Link>
          {payload.stats.canViewFinancials && (
            <Link href="/agent/commissions" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">My Commissions</Link>
          )}
          {payload.stats.canViewFinancials && (
            <Link href="/agent/certificate" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">My Certificate</Link>
          )}
          <Link href="/agent/messages" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Messages</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => (
          <Link key={item.label} href={item.href || "#"} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              {item.label}
              {item.tooltip ? (
                <span title={item.tooltip}><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span>
              ) : null}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
          </Link>
        ))}
      </div>

      {plWidget && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">This Month Profit & Loss</h2>
            <Link href="/agent/pl" className="text-xs text-blue-600 hover:underline">Open P&L</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-slate-500">Income</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(plWidget.totalIncome)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-slate-500">Expenses</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(plWidget.totalExpenses)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-slate-500">Net Profit</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(plWidget.netProfit)}</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Application Pipeline</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {payload.pipeline.map((stage) => (
            <Link key={stage.key} href={stage.href} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <p className="text-xs text-slate-500">{stage.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stage.count}</p>
            </Link>
          ))}
        </div>
      </section>

      <RecruitmentFunnelSection endpoint="/api/agent/dashboard/funnel-stats" title="Recruitment Funnel" />

      {payload.stats.isBranchCounsellor && (
        <MyPerformanceCard endpoint="/api/agent/kpi/my-performance" />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Students</h2>
            <Link href="/agent/students" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Course</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Counsellor</th>
                  <th className="px-2 py-2">Updated</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {payload.recentStudents.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{toFlag(row.nationality)} {row.studentName}</div>
                      <div className="text-xs text-slate-500">{row.universityName}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{row.courseName}</td>
                    <td className="px-2 py-2 text-slate-700">{row.pipelineStage}</td>
                    <td className="px-2 py-2 text-slate-700">{row.branchCounsellorName !== "-" ? row.branchCounsellorName : row.assignedCounsellorName}</td>
                    <td className="px-2 py-2 text-slate-500">{new Date(row.lastUpdatedAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-2 py-2 text-right">
                      <Link href={row.href} className="text-blue-600 hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
                {payload.recentStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-slate-500">No recent students found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {payload.stats.canViewFinancials && (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Commissions</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-600">Total Expected</span><span className="font-medium text-slate-900">{formatMoney(payload.commissions.expected, payload.commissions.currency)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Pending Invoice</span><span className="font-medium text-slate-900">{formatMoney(payload.commissions.pendingInvoice, payload.commissions.currency)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Paid YTD</span><span className="font-medium text-slate-900">{formatMoney(payload.commissions.paidYtd, payload.commissions.currency)}</span></div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Payouts</p>
              <div className="mt-2 space-y-2">
                {payload.commissions.recentPayouts.map((payout) => (
                  <div key={payout.id} className="rounded-md border border-slate-100 p-2 text-sm">
                    <p className="font-medium text-slate-900">{payout.studentName}</p>
                    <p className="text-xs text-slate-500">{new Date(payout.paidAt).toLocaleDateString("en-GB")}</p>
                    <p className="text-sm text-slate-700">{formatMoney(payout.amount, payout.currency)}</p>
                  </div>
                ))}
                {payload.commissions.recentPayouts.length === 0 && <p className="text-xs text-slate-500">No recent payouts.</p>}
              </div>
            </div>
          </section>
        )}
      </div>

      <InterviewOverviewSection
        endpoint="/api/agent/dashboard/interview-stats"
        emptyMessage="No interview data yet. Interview tracking will appear here as your students progress through their applications."
      />

      {mockInterviewSummary && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">Mock Interviews Completed (This Month)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{mockInterviewSummary.completed}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">Pass Rate (This Month)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{mockInterviewSummary.passRate.toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">Students Needing Support</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{mockInterviewSummary.needingSupport}</p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Counsellor Performance</h2>
            {!payload.stats.isBranchCounsellor && (
              <Link href="/agent/team" className="text-xs text-blue-600 hover:underline">Manage team</Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Counsellor</th>
                  <th className="px-2 py-2">Students</th>
                  <th className="px-2 py-2">Active Apps</th>
                  <th className="px-2 py-2">Enrolled</th>
                  <th className="px-2 py-2">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {payload.counsellors.counsellors.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.email}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{item.studentsCount}</td>
                    <td className="px-2 py-2 text-slate-700">{item.activeApplications}</td>
                    <td className="px-2 py-2 text-slate-700">{item.enrolledThisYear}</td>
                    <td className="px-2 py-2 text-slate-700">{item.conversionRate}%</td>
                  </tr>
                ))}
                {payload.counsellors.counsellors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-slate-500">No internal counsellors found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Referral</h2>
          <p className="mt-2 text-sm text-slate-600">Registrations: <span className="font-medium text-slate-900">{payload.stats.referral.registrations}</span></p>
          <p className="text-sm text-slate-600">Code: <span className="font-medium text-slate-900">{payload.stats.referral.referralCode || "-"}</span></p>
          {payload.stats.referral.referralUrl && (
            <a href={payload.stats.referral.referralUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-blue-600 hover:underline">
              {payload.stats.referral.referralUrl}
            </a>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Team size: {payload.counsellors.teamSize} · Unassigned students: {payload.counsellors.unassignedStudents}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Activity Feed</h2>
          <Link href="/agent/students" className="text-xs text-blue-600 hover:underline">Open students</Link>
        </div>
        <div className="space-y-2">
          {payload.activity.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-GB")}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">By {item.actorName}</p>
              {item.description && <p className="mt-1 text-sm text-slate-700">{item.description}</p>}
              {item.href && (
                <Link href={item.href} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
                  View student
                </Link>
              )}
            </div>
          ))}
          {payload.activity.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
