"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  GraduationCap,
  PoundSterling,
  Handshake,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckSquare,
  ShieldAlert,
  CircleHelp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/cn";
import RecruitmentFunnelSection from "@/components/RecruitmentFunnelSection";
import MyPerformanceCard from "@/components/MyPerformanceCard";
import InterviewOverviewSection from "@/components/InterviewOverviewSection";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StatValue {
  value: number;
  change: number | null;
}

interface StatsData {
  leadsThisMonth: StatValue;
  activeApplications: StatValue;
  enrolledStudents: StatValue;
  // null when the API returns counsellor-scoped view (hides these cards)
  revenueThisMonth: StatValue | null;
  activeSubAgents: StatValue | null;
  pendingSubAgents: StatValue | null;
  totalStudents: StatValue;
  totalApplications: StatValue;
  avgApplicationsPerStudent: StatValue;
}

interface ChartItem {
  status: string;
  label: string;
  count: number;
}

interface ChartsData {
  leadFunnel: ChartItem[];
  applicationStatus: ChartItem[];
}

interface PLChartsData {
  monthlyTrend: Array<{ month: number; label: string; income: number; expenses: number; profit: number }>;
  incomeByCountry: Array<{ country: string; amount: number }>;
  expenseByCategory: Array<{ category: string; amount: number }>;
}

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  details: string | null;
  userName: string;
  createdAt: string;
}

interface TaskEntry {
  id: string;
  title: string;
  studentName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
}

interface WidgetsData {
  recentActivity: ActivityEntry[];
  upcomingTasks: TaskEntry[];
  flaggedDocsCount: number;
}

interface MockInterviewSummary {
  completed: number;
  passRate: number;
  needingSupport: number;
}

const EMPTY_STATS: StatsData = {
  leadsThisMonth: { value: 0, change: 0 },
  activeApplications: { value: 0, change: 0 },
  enrolledStudents: { value: 0, change: 0 },
  revenueThisMonth: { value: 0, change: 0 },
  activeSubAgents: { value: 0, change: 0 },
  pendingSubAgents: { value: 0, change: 0 },
  totalStudents: { value: 0, change: null },
  totalApplications: { value: 0, change: null },
  avgApplicationsPerStudent: { value: 0, change: null },
};

const EMPTY_CHARTS: ChartsData = {
  leadFunnel: [],
  applicationStatus: [],
};

const EMPTY_WIDGETS: WidgetsData = {
  recentActivity: [],
  upcomingTasks: [],
  flaggedDocsCount: 0,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatGBP(value: number): string {
  if (value === 0) return "£0";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-slate-200", className)} />;
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-3.5 w-32 mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <Skeleton className="h-4 w-40 mb-5" />
      <Skeleton className="h-52 w-full" />
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <Skeleton className="h-4 w-32 mb-4" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="mb-3">
          <Skeleton className="h-3.5 w-full mb-1.5" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  change: number | null;
  icon: React.ReactNode;
  gradientClass: string;
  href?: string;
  tooltip?: string;
}

function StatCard({ label, value, change, icon, gradientClass, href, tooltip }: StatCardProps) {
  const changeEl = change !== null ? (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        change >= 0 ? "text-emerald-100" : "text-red-100",
      )}
    >
      {change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {change >= 0 ? "+" : ""}
      {change}% vs last month
    </span>
  ) : (
    <span className="text-xs text-white/70">—</span>
  );

  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/80 truncate flex items-center gap-1">
          {label}
          {tooltip && (
            <span title={tooltip}>
              <CircleHelp className="h-3.5 w-3.5 text-white/90" />
            </span>
          )}
        </p>
        <p className="mt-1.5 text-3xl font-bold text-white tabular-nums">{value}</p>
        <div className="mt-1.5">{changeEl}</div>
      </div>
      <span
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 text-[#1B2A4A] bg-white/90",
        )}
      >
        {icon}
      </span>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
      >
        <div className={cn("rounded-2xl p-5 shadow-[0_16px_30px_rgba(27,42,74,0.25)]", gradientClass)}>{inner}</div>
        <p className="mt-3 text-xs font-medium text-[#1B2A4A] group-hover:underline">View →</p>
      </Link>
    );
  }

  return (
    <div className={cn("rounded-2xl p-5 shadow-[0_16px_30px_rgba(27,42,74,0.25)]", gradientClass)}>{inner}</div>
  );
}

// ─── Application status colour map ────────────────────────────────────────────

const APP_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  DOCUMENTS_PENDING: "#f59e0b",
  SUBMITTED: "#3b82f6",
  UNDER_REVIEW: "#8b5cf6",
  CONDITIONAL_OFFER: "#06b6d4",
  UNCONDITIONAL_OFFER: "#10b981",
  CAS_ISSUED: "#14b8a6",
  VISA_APPLIED: "#f97316",
  VISA_APPROVED: "#22c55e",
  VISA_REJECTED: "#ef4444",
  ENROLLED: "#1d4ed8",
  WITHDRAWN: "#6b7280",
};

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#6b7280",
];

// ─── Charts section ────────────────────────────────────────────────────────────

function LeadFunnelChart({ data }: { data: ChartItem[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Lead Conversion Funnel</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
            formatter={(val: number | undefined) => [val ?? 0, "Leads"]}
          />
          <Bar dataKey="count" fill="#1B2A4A" radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AppStatusPieChart({ data }: { data: ChartItem[] }) {
  const nonZero = data.filter((d) => d.count > 0);
  const total = nonZero.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Application Status Breakdown</h3>

      {nonZero.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
          No applications yet
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={nonZero}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={44}
                paddingAngle={2}
              >
                {nonZero.map((entry, i) => (
                  <Cell
                    key={entry.status}
                    fill={APP_STATUS_COLORS[entry.status] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                formatter={(val: number | undefined) => [val ?? 0, "applications"]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {nonZero.map((entry, i) => (
              <div key={entry.status} className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      APP_STATUS_COLORS[entry.status] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                  }}
                />
                <span className="text-xs text-slate-600 truncate">{entry.label}</span>
                <span className="text-xs font-semibold text-slate-800 ml-auto shrink-0">
                  {total > 0 ? Math.round((entry.count / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PLIncomeExpenseChart({ data }: { data: PLChartsData["monthlyTrend"] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Monthly Income vs Expenses</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(val: number | undefined) => [formatGBP(val || 0), ""]} />
          <Line type="monotone" dataKey="income" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PLProfitTrendChart({ data }: { data: PLChartsData["monthlyTrend"] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Net Profit Trend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(val: number | undefined) => [formatGBP(val || 0), "Profit"]} />
          <Bar dataKey="profit" fill="#0f766e" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PLExpenseBreakdownChart({ data }: { data: PLChartsData["expenseByCategory"] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Expense Breakdown by Category</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data.filter((d) => d.amount > 0)} dataKey="amount" nameKey="category" outerRadius={80} innerRadius={40}>
            {data.map((entry, i) => (
              <Cell key={entry.category} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: number | undefined) => [formatGBP(val || 0), ""]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function PLRevenueByCountryChart({ data }: { data: PLChartsData["incomeByCountry"] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Revenue by Country</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.slice(0, 8)} margin={{ top: 4, right: 4, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="country" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(val: number | undefined) => [formatGBP(val || 0), ""]} />
          <Bar dataKey="amount" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Widget: Recent Activity ───────────────────────────────────────────────────

function RecentActivityWidget({ data }: { data: ActivityEntry[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Recent Activity</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400 flex-1 flex items-center justify-center py-6">
          No recent activity
        </p>
      ) : (
        <ul className="space-y-3 overflow-hidden">
          {data.map((log) => (
            <li key={log.id} className="flex gap-2.5">
              <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                {log.entityType.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700 leading-snug">
                  <span className="font-medium">{log.userName}</span>{" "}
                  <span className="lowercase">{log.action}</span>{" "}
                  <span className="text-slate-500">{log.entityType}</span>
                  {log.details && (
                    <span className="text-slate-400"> — {log.details}</span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Widget: Upcoming Tasks ────────────────────────────────────────────────────

function UpcomingTasksWidget({ data }: { data: TaskEntry[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-[0_10px_24px_rgba(27,42,74,0.08)]">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Upcoming Tasks</h3>
      {data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
          <CheckSquare className="w-8 h-8 opacity-30" />
          <p className="text-sm">No upcoming tasks</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((task) => {
            const dateLabel = task.dueDate
              ? new Date(task.dueDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              : null;

            return (
              <li key={task.id}>
                <Link
                  href="/dashboard/tasks"
                  className="group flex items-start gap-2 hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors"
                >
                  <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate group-hover:text-blue-700">
                      {task.title}
                    </p>
                    {task.studentName && (
                      <p className="text-[10px] text-slate-500 truncate">{task.studentName}</p>
                    )}
                  </div>
                  {dateLabel && (
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                        task.isOverdue
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {task.isOverdue ? "Overdue" : dateLabel}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Widget: Flagged Documents ─────────────────────────────────────────────────

function FlaggedDocsWidget({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/documents"
      className="group bg-white rounded-2xl border border-slate-200 p-5 flex flex-col hover:border-red-200 hover:shadow-[0_10px_24px_rgba(27,42,74,0.1)] transition-all"
    >
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Flagged Documents</h3>
      {count === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2">
          <span className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-emerald-500" />
          </span>
          <p className="text-sm text-emerald-600 font-medium">No flagged documents</p>
          <p className="text-xs text-slate-400">All documents look good</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3">
          <span className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </span>
          <p className="text-5xl font-bold text-red-600 tabular-nums">{count}</p>
          <p className="text-sm text-slate-500">
            {count === 1 ? "document" : "documents"} flagged as HIGH risk
          </p>
          <p className="text-xs font-medium text-red-600 group-hover:underline">
            Review now →
          </p>
        </div>
      )}
    </Link>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({ role }: { role: string }) {
  // Role-derived display flags (derived from stable prop — no re-computation needed)
  const isCounsellor = role === "COUNSELLOR";
  const showCharts = !isCounsellor;       // ADMIN + MANAGER + custom roles see charts
  const showFlaggedDocs = role === "ADMIN"; // Only ADMIN sees flagged docs widget

  const [stats, setStats] = useState<StatsData | null>(null);
  // Pre-fill charts with empty data when not needed so isLoading resolves correctly
  const [charts, setCharts] = useState<ChartsData | null>(
    showCharts ? null : { leadFunnel: [], applicationStatus: [] },
  );
  const [plCharts, setPlCharts] = useState<PLChartsData | null>(showCharts ? null : { monthlyTrend: [], incomeByCountry: [], expenseByCategory: [] });
  const [widgets, setWidgets] = useState<WidgetsData | null>(null);
  const [mockInterviewSummary, setMockInterviewSummary] = useState<MockInterviewSummary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const errs: string[] = [];

    const fetchStats = fetch("/api/admin/dashboard/stats")
      .then((r) => {
        if (!r.ok) throw new Error("stats_failed");
        return r.json();
      })
      .then((j) => setStats(j.data))
      .catch(() => {
        errs.push("Failed to load stats.");
        setStats(EMPTY_STATS);
      });

    const fetchCharts = showCharts
      ? fetch("/api/admin/dashboard/charts")
          .then((r) => {
            if (!r.ok) throw new Error("charts_failed");
            return r.json();
          })
          .then((j) => setCharts(j.data))
          .catch(() => {
            errs.push("Failed to load chart data.");
            setCharts(EMPTY_CHARTS);
          })
      : Promise.resolve();

    const fetchPLCharts = showCharts
      ? fetch(`/api/pl/summary?year=${new Date().getUTCFullYear()}`)
          .then((r) => {
            if (!r.ok) throw new Error("pl_charts_failed");
            return r.json();
          })
          .then((j) => setPlCharts({
            monthlyTrend: j.data?.monthlyTrend || [],
            incomeByCountry: j.data?.incomeByCountry || [],
            expenseByCategory: j.data?.expenseByCategory || [],
          }))
          .catch(() => {
            errs.push("Failed to load P&L charts.");
            setPlCharts({ monthlyTrend: [], incomeByCountry: [], expenseByCategory: [] });
          })
      : Promise.resolve();

    const fetchWidgets = fetch("/api/admin/dashboard/widgets")
      .then((r) => {
        if (!r.ok) throw new Error("widgets_failed");
        return r.json();
      })
      .then((j) => setWidgets(j.data))
      .catch(() => {
        errs.push("Failed to load widget data.");
        setWidgets(EMPTY_WIDGETS);
      });

    const fetchMockInterviewSummary = fetch("/api/dashboard/mock-interview-summary")
      .then((r) => {
        if (!r.ok) throw new Error("mock_interview_summary_failed");
        return r.json();
      })
      .then((j) => setMockInterviewSummary(j.data))
      .catch(() => {
        errs.push("Failed to load mock interview monthly summary.");
        setMockInterviewSummary({ completed: 0, passRate: 0, needingSupport: 0 });
      });

    Promise.all([fetchStats, fetchCharts, fetchPLCharts, fetchWidgets, fetchMockInterviewSummary]).then(() => {
      if (errs.length) setErrors(errs);
      setStats((prev) => prev ?? EMPTY_STATS);
      setCharts((prev) => prev ?? EMPTY_CHARTS);
      setPlCharts((prev) => prev ?? { monthlyTrend: [], incomeByCountry: [], expenseByCategory: [] });
      setWidgets((prev) => prev ?? EMPTY_WIDGETS);
      setMockInterviewSummary((prev) => prev ?? { completed: 0, passRate: 0, needingSupport: 0 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = !stats || !charts || !plCharts || !widgets;

  // Skeleton counts depend on role
  const statSkeletonCount = isCounsellor ? 3 : 6;
  const widgetSkeletonCount = showFlaggedDocs ? 3 : 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1B2A4A]">Dashboard</h1>
        <div className="mt-2 h-1 w-24 rounded-full bg-[#F5A623]" />
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Errors */}
      {errors.map((e) => (
        <ErrorBanner key={e} message={e} />
      ))}

      {/* ── Row 1: Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: statSkeletonCount }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : isCounsellor ? (
          // Counsellor sees their own 3 stats only
          <>
            <StatCard
              label="My Leads This Month"
              value={formatNumber(stats.leadsThisMonth.value)}
              change={stats.leadsThisMonth.change}
              icon={<Users className="w-5 h-5" />}
              gradientClass="bg-gradient-to-br from-[#1B2A4A] to-[#2E4B7E]"
            />
            <StatCard
              label="My Active Applications"
              value={formatNumber(stats.activeApplications.value)}
              change={stats.activeApplications.change}
              icon={<FileText className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#1B2A4A] to-[#3A4F74]"
            />
            <StatCard
              label="My Enrolled Students"
              value={formatNumber(stats.enrolledStudents.value)}
              change={stats.enrolledStudents.change}
              icon={<GraduationCap className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#1B2A4A] to-[#4A5C7A]"
            />
          </>
        ) : (
          // ADMIN / MANAGER / custom roles see all 6 stats
          <>
            <StatCard
              label="Total Leads This Month"
              value={formatNumber(stats.leadsThisMonth.value)}
              change={stats.leadsThisMonth.change}
              icon={<Users className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#1B2A4A] to-[#2E4B7E]"
            />
            <StatCard
              label="Active Applications"
              value={formatNumber(stats.activeApplications.value)}
              change={stats.activeApplications.change}
              icon={<FileText className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#263A63] to-[#415a8a]"
            />
            <StatCard
              label="Total Students"
              value={formatNumber(stats.totalStudents.value)}
              change={stats.totalStudents.change}
              icon={<Users className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#264e63] to-[#3b748f]"
              tooltip="Number of unique students in the system. One student can have multiple applications."
            />
            <StatCard
              label="Total Applications"
              value={formatNumber(stats.totalApplications.value)}
              change={stats.totalApplications.change}
              icon={<FileText className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#27435a] to-[#466f91]"
              tooltip="Total number of applications submitted. One student may have up to 5 applications."
            />
            <StatCard
              label="Avg Apps per Student"
              value={stats.avgApplicationsPerStudent.value.toFixed(2)}
              change={stats.avgApplicationsPerStudent.change}
              icon={<TrendingUp className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#2d475f] to-[#4f6480]"
              tooltip="Average applications per student (total applications / total students)."
            />
            <StatCard
              label="Enrolled Students"
              value={formatNumber(stats.enrolledStudents.value)}
              change={stats.enrolledStudents.change}
              icon={<GraduationCap className="w-6 h-6" />}
              gradientClass="bg-gradient-to-br from-[#2B3F68] to-[#4f678d]"
            />
            {stats.revenueThisMonth && (
              <StatCard
                label="Revenue This Month"
                value={formatGBP(stats.revenueThisMonth.value)}
                change={stats.revenueThisMonth.change}
                icon={<PoundSterling className="w-6 h-6" />}
                gradientClass="bg-gradient-to-br from-[#1B2A4A] to-[#F5A623]"
              />
            )}
            {stats.activeSubAgents && (
              <StatCard
                label="Active Sub-Agents"
                value={formatNumber(stats.activeSubAgents.value)}
                change={stats.activeSubAgents.change}
                icon={<Handshake className="w-6 h-6" />}
                gradientClass="bg-gradient-to-br from-[#304b73] to-[#56759d]"
              />
            )}
            {stats.pendingSubAgents && (
              <StatCard
                label="Pending Sub-Agent Applications"
                value={formatNumber(stats.pendingSubAgents.value)}
                change={stats.pendingSubAgents.change}
                icon={<Clock className="w-6 h-6" />}
                gradientClass="bg-gradient-to-br from-[#3b4f72] to-[#6f5e3b]"
                href="/dashboard/sub-agents/applications"
              />
            )}
          </>
        )}
      </div>

      {!isCounsellor && (
        <InterviewOverviewSection
          endpoint="/api/dashboard/interview-stats"
          emptyMessage="No interview data yet. Interview tracking will appear here as your students progress through their applications."
        />
      )}

      {mockInterviewSummary && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">Mock Interviews Completed (This Month)</p>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(mockInterviewSummary.completed)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">Mock Interview Pass Rate (This Month)</p>
            <p className="text-2xl font-bold text-slate-900">{mockInterviewSummary.passRate.toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">Students Needing Support</p>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(mockInterviewSummary.needingSupport)}</p>
          </div>
        </section>
      )}

      {/* ── Row 2: Charts (ADMIN + MANAGER + custom roles only) ────────────── */}
      {showCharts && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {!charts || charts.leadFunnel.length === 0 ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
              </>
            ) : (
              <>
                <LeadFunnelChart data={charts.leadFunnel} />
                <AppStatusPieChart data={charts.applicationStatus} />
              </>
            )}
          </div>
          {!plCharts ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PLIncomeExpenseChart data={plCharts.monthlyTrend} />
              <PLProfitTrendChart data={plCharts.monthlyTrend} />
              <PLExpenseBreakdownChart data={plCharts.expenseByCategory} />
              <PLRevenueByCountryChart data={plCharts.incomeByCountry} />
            </div>
          )}
        </div>
      )}

      {!isCounsellor && (
        <RecruitmentFunnelSection endpoint="/api/dashboard/funnel-stats" title="Recruitment Funnel" />
      )}

      {isCounsellor && (
        <MyPerformanceCard endpoint="/api/dashboard/kpi/my-performance" />
      )}

      {/* ── Row 3: Widgets ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          showFlaggedDocs ? "lg:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        {!widgets ? (
          Array.from({ length: widgetSkeletonCount }).map((_, i) => <WidgetSkeleton key={i} />)
        ) : (
          <>
            <RecentActivityWidget data={widgets.recentActivity} />
            <UpcomingTasksWidget data={widgets.upcomingTasks} />
            {showFlaggedDocs && <FlaggedDocsWidget count={widgets.flaggedDocsCount} />}
          </>
        )}
      </div>
    </div>
  );
}
