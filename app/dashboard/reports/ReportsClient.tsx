"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import RecruitmentFunnelSection from "@/components/RecruitmentFunnelSection";

export interface VisaStatusCountRow {
  status: string;
  count: number;
}

export interface CountryApprovalRow {
  country: string;
  totalApplied: number;
  approved: number;
  rejected: number;
  approvalRate: number;
}

export interface UpcomingAppointmentRow {
  id: string;
  studentName: string;
  date: string;
  location: string;
}

export interface CommissionRevenueSummary {
  thisMonth: { gross: number; agentPayouts: number; eduquanticaNet: number };
  thisYear: { gross: number; agentPayouts: number; eduquanticaNet: number };
  allTime: { gross: number; agentPayouts: number; eduquanticaNet: number };
}

export interface TopSubAgentRow {
  agencyName: string;
  tier: string;
  studentsEnrolled: number;
  totalEarned: number;
  totalPaid: number;
  outstanding: number;
}

export interface TopUniversityCommissionRow {
  universityName: string;
  grossCommission: number;
}

export interface CommissionCountryRow {
  country: string;
  grossCommission: number;
}

export interface CommissionMonthlyTrendRow {
  month: string;
  gross: number;
  net: number;
}

export interface ApplicationFeeSummary {
  totalCollectedThisMonth: number;
  totalPending: number;
  totalWaived: number;
  ucasGroupedPaymentsCount: number;
}

export interface ApplicationFeePaymentRow {
  id: string;
  studentName: string;
  universityName: string;
  feeType: string;
  amount: number;
  currency: string;
  status: string;
  paidBy: string | null;
  paidByRole: string | null;
  date: string;
}

export interface AcademicMatchDistributionRow {
  status: string;
  count: number;
}

export interface CommonMissingSubjectRow {
  subject: string;
  count: number;
}

export interface AvgMatchScoreNationalityRow {
  nationality: string;
  avgScore: number;
}

export interface ScholarshipStatusCountRow {
  status: string;
  count: number;
}

export interface TopScholarshipUniversityRow {
  universityName: string;
  applications: number;
  awards: number;
  awardedAmount: number;
}

export interface ScholarshipMonthlyTrendRow {
  month: string;
  applications: number;
}

export interface ScholarshipSummary {
  interested: number;
  applied: number;
  shortlisted: number;
  awarded: number;
  rejected: number;
  totalApplications: number;
  totalAwardedAmount: number;
  awardRate: number;
  applyRate: number;
}

export interface ApplicationPipelineCountRow {
  stage: string;
  label: string;
  count: number;
}

export interface ApplicationStageConversionRow {
  fromStage: string;
  fromLabel: string;
  toStage: string;
  toLabel: string;
  reached: number;
  converted: number;
  conversionRate: number;
}

export interface ApplicationStageDurationRow {
  fromStage: string;
  fromLabel: string;
  toStage: string;
  toLabel: string;
  sampleSize: number;
  averageDays: number;
}

export interface InterviewBreakdownRow {
  key: string;
  label: string;
  count: number;
}

export interface InterviewListRow {
  applicationId: string;
  studentName: string;
  university: string;
  course: string;
  interviewType: "PRE_CAS" | "VISA";
  stage: string | null;
  bookedDate: string | null;
  outcome: string | null;
  counsellor: string | null;
  subAgent: string | null;
}

export interface InterviewSummary {
  preCasRequired: number;
  visaRequired: number;
  preCasPassRate: number;
  visaPassRate: number;
}

export interface MockInterviewMonthlyRow {
  month: string;
  completed: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface MockInterviewDetailRow {
  interviewId: string;
  studentId: string;
  studentName: string;
  university: string;
  course: string;
  interviewType: string;
  counsellor: string | null;
  subAgent: string | null;
  completedAt: string;
  overallScore: number;
  isPassed: boolean;
  recommendation: string;
  reportDocumentUrl: string | null;
}

export interface EduviChatSummary {
  totalSessionsThisMonth: number;
  leadsCapturedThisMonth: number;
  leadConversionRate: number;
  averageSessionDurationMinutes: number;
}

export interface EduviCommonQuestionRow {
  question: string;
  count: number;
}

export interface EduviLanguageUsageRow {
  language: string;
  count: number;
}

export interface EduviChatSessionRow {
  sessionId: string;
  startedAt: string;
  personName: string;
  sessionType: string;
  messagesExchanged: number;
  leadCaptured: boolean;
  language: string;
}

interface ReportsClientProps {
  visaStatusCounts: VisaStatusCountRow[];
  countryApprovalRows: CountryApprovalRow[];
  averageDaysToDecision: number;
  upcomingAppointments: UpcomingAppointmentRow[];
  commissionRevenueSummary: CommissionRevenueSummary;
  topSubAgents: TopSubAgentRow[];
  topUniversities: TopUniversityCommissionRow[];
  commissionByCountry: CommissionCountryRow[];
  monthlyCommissionTrend: CommissionMonthlyTrendRow[];
  applicationFeeSummary: ApplicationFeeSummary;
  applicationFeePayments: ApplicationFeePaymentRow[];
  academicMatchDistribution: AcademicMatchDistributionRow[];
  commonMissingSubjects: CommonMissingSubjectRow[];
  profileCompletionRate: number;
  avgMatchScoreByNationality: AvgMatchScoreNationalityRow[];
  scholarshipStatusCounts: ScholarshipStatusCountRow[];
  topScholarshipUniversities: TopScholarshipUniversityRow[];
  scholarshipMonthlyTrend: ScholarshipMonthlyTrendRow[];
  scholarshipSummary: ScholarshipSummary;
  applicationPipelineCounts: ApplicationPipelineCountRow[];
  applicationStageConversions: ApplicationStageConversionRow[];
  applicationStageDurations: ApplicationStageDurationRow[];
  interviewSummary: InterviewSummary;
  preCasStageBreakdown: InterviewBreakdownRow[];
  preCasOutcomeBreakdown: InterviewBreakdownRow[];
  visaOutcomeBreakdown: InterviewBreakdownRow[];
  interviewRows: InterviewListRow[];
  mockInterviewMonthlyRows: MockInterviewMonthlyRow[];
  mockInterviewDetails: MockInterviewDetailRow[];
  eduviChatSummary: EduviChatSummary;
  eduviCommonQuestions: EduviCommonQuestionRow[];
  eduviLanguageUsage: EduviLanguageUsageRow[];
  eduviChatSessions: EduviChatSessionRow[];
}

const TAB_OPTIONS = ["Applications", "Visa", "Interview Tracking", "Mock Interviews", "Commission", "Application Fees", "Academic Matching", "Scholarships", "Eduvi Chatbot"] as const;

type TabOption = (typeof TAB_OPTIONS)[number];

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
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

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value || 0);
}

export default function ReportsClient({
  visaStatusCounts,
  countryApprovalRows,
  averageDaysToDecision,
  upcomingAppointments,
  commissionRevenueSummary,
  topSubAgents,
  topUniversities,
  commissionByCountry,
  monthlyCommissionTrend,
  applicationFeeSummary,
  applicationFeePayments,
  academicMatchDistribution,
  commonMissingSubjects,
  profileCompletionRate,
  avgMatchScoreByNationality,
  scholarshipStatusCounts,
  topScholarshipUniversities,
  scholarshipMonthlyTrend,
  scholarshipSummary,
  applicationPipelineCounts,
  applicationStageConversions,
  applicationStageDurations,
  interviewSummary,
  preCasStageBreakdown,
  preCasOutcomeBreakdown,
  visaOutcomeBreakdown,
  interviewRows,
  mockInterviewMonthlyRows,
  mockInterviewDetails,
  eduviChatSummary,
  eduviCommonQuestions,
  eduviLanguageUsage,
  eduviChatSessions,
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState<TabOption>("Applications");
  const [isRunningReminders, setIsRunningReminders] = useState(false);
  const [runReminderMessage, setRunReminderMessage] = useState<string | null>(null);
  const [interviewTypeFilter, setInterviewTypeFilter] = useState<"ALL" | "PRE_CAS" | "VISA">("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("ALL");
  const [counsellorFilter, setCounsellorFilter] = useState<string>("ALL");
  const [subAgentFilter, setSubAgentFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mockMonthFilter, setMockMonthFilter] = useState<string>("ALL");
  const [mockCounsellorFilter, setMockCounsellorFilter] = useState<string>("ALL");
  const [mockSubAgentFilter, setMockSubAgentFilter] = useState<string>("ALL");
  const [mockResultFilter, setMockResultFilter] = useState<"ALL" | "PASS" | "FAIL">("ALL");
  const [feeStatusFilter, setFeeStatusFilter] = useState<string>("ALL");
  const [feeTypeFilter, setFeeTypeFilter] = useState<string>("ALL");
  const [feeDateFrom, setFeeDateFrom] = useState("");
  const [feeDateTo, setFeeDateTo] = useState("");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TAB_OPTIONS.includes(tab as TabOption)) {
      setActiveTab(tab as TabOption);
    }
  }, []);

  const chartData = useMemo(
    () =>
      visaStatusCounts.map((item) => ({
        status: formatStatusLabel(item.status),
        count: item.count,
      })),
    [visaStatusCounts],
  );

  const stageOptions = useMemo(
    () => Array.from(new Set(interviewRows.map((row) => row.stage).filter((stage): stage is string => !!stage))),
    [interviewRows],
  );
  const outcomeOptions = useMemo(
    () => Array.from(new Set(interviewRows.map((row) => row.outcome).filter((outcome): outcome is string => !!outcome))),
    [interviewRows],
  );
  const counsellorOptions = useMemo(
    () => Array.from(new Set(interviewRows.map((row) => row.counsellor).filter((item): item is string => !!item))),
    [interviewRows],
  );
  const subAgentOptions = useMemo(
    () => Array.from(new Set(interviewRows.map((row) => row.subAgent).filter((item): item is string => !!item))),
    [interviewRows],
  );

  const filteredInterviewRows = useMemo(() => {
    return interviewRows.filter((row) => {
      if (interviewTypeFilter !== "ALL" && row.interviewType !== interviewTypeFilter) return false;
      if (stageFilter !== "ALL" && (row.stage || "") !== stageFilter) return false;
      if (outcomeFilter !== "ALL" && (row.outcome || "") !== outcomeFilter) return false;
      if (counsellorFilter !== "ALL" && (row.counsellor || "") !== counsellorFilter) return false;
      if (subAgentFilter !== "ALL" && (row.subAgent || "") !== subAgentFilter) return false;

      if (dateFrom && row.bookedDate) {
        if (new Date(row.bookedDate).getTime() < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      }
      if (dateTo && row.bookedDate) {
        if (new Date(row.bookedDate).getTime() > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      }

      if ((dateFrom || dateTo) && !row.bookedDate) return false;
      return true;
    });
  }, [interviewRows, interviewTypeFilter, stageFilter, outcomeFilter, counsellorFilter, subAgentFilter, dateFrom, dateTo]);

  const mockMonthOptions = useMemo(
    () => Array.from(new Set(mockInterviewDetails.map((row) => row.completedAt.slice(0, 7)))).sort().reverse(),
    [mockInterviewDetails],
  );

  const mockCounsellorOptions = useMemo(
    () => Array.from(new Set(mockInterviewDetails.map((row) => row.counsellor).filter((item): item is string => !!item))),
    [mockInterviewDetails],
  );

  const mockSubAgentOptions = useMemo(
    () => Array.from(new Set(mockInterviewDetails.map((row) => row.subAgent).filter((item): item is string => !!item))),
    [mockInterviewDetails],
  );

  const filteredMockRows = useMemo(() => {
    return mockInterviewDetails.filter((row) => {
      if (mockMonthFilter !== "ALL" && row.completedAt.slice(0, 7) !== mockMonthFilter) return false;
      if (mockCounsellorFilter !== "ALL" && (row.counsellor || "") !== mockCounsellorFilter) return false;
      if (mockSubAgentFilter !== "ALL" && (row.subAgent || "") !== mockSubAgentFilter) return false;
      if (mockResultFilter === "PASS" && !row.isPassed) return false;
      if (mockResultFilter === "FAIL" && row.isPassed) return false;
      return true;
    });
  }, [mockInterviewDetails, mockMonthFilter, mockCounsellorFilter, mockSubAgentFilter, mockResultFilter]);

  const mockCards = useMemo(() => {
    const total = filteredMockRows.length;
    const passed = filteredMockRows.filter((row) => row.isPassed).length;
    const failed = total - passed;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    return {
      total,
      passRate,
      support: failed,
    };
  }, [filteredMockRows]);

  const feeStatusOptions = useMemo(
    () => Array.from(new Set(applicationFeePayments.map((row) => row.status))).sort(),
    [applicationFeePayments],
  );

  const feeTypeOptions = useMemo(
    () => Array.from(new Set(applicationFeePayments.map((row) => row.feeType))).sort(),
    [applicationFeePayments],
  );

  const filteredFeeRows = useMemo(() => {
    return applicationFeePayments.filter((row) => {
      if (feeStatusFilter !== "ALL" && row.status !== feeStatusFilter) return false;
      if (feeTypeFilter !== "ALL" && row.feeType !== feeTypeFilter) return false;

      const timestamp = new Date(row.date).getTime();
      if (feeDateFrom) {
        const fromTs = new Date(`${feeDateFrom}T00:00:00`).getTime();
        if (timestamp < fromTs) return false;
      }
      if (feeDateTo) {
        const toTs = new Date(`${feeDateTo}T23:59:59`).getTime();
        if (timestamp > toTs) return false;
      }

      return true;
    });
  }, [applicationFeePayments, feeStatusFilter, feeTypeFilter, feeDateFrom, feeDateTo]);

  function exportInterviewCsv() {
    const header = ["Student Name", "University", "Course", "Interview Type", "Stage", "Booked Date", "Outcome", "Counsellor", "Sub-Agent"];
    const rows = filteredInterviewRows.map((row) => [
      row.studentName,
      row.university,
      row.course,
      row.interviewType === "PRE_CAS" ? "Pre-CAS" : "Visa",
      row.stage || "-",
      row.bookedDate ? formatDate(row.bookedDate) : "-",
      row.outcome ? formatStatusLabel(row.outcome) : "-",
      row.counsellor || "-",
      row.subAgent || "-",
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportMockInterviewCsv() {
    const header = ["Student Name", "University", "Course", "Interview Type", "Completed At", "Score", "Result", "Counsellor", "Sub-Agent"];
    const rows = filteredMockRows.map((row) => [
      row.studentName,
      row.university,
      row.course,
      row.interviewType,
      formatDate(row.completedAt),
      row.overallScore.toFixed(2),
      row.isPassed ? "PASS" : "FAIL",
      row.counsellor || "-",
      row.subAgent || "-",
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mock-interviews-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportEduviCsv() {
    const header = ["Date & Time", "Visitor/Student", "Session Type", "Messages", "Lead Captured", "Language", "Session ID"];
    const rows = eduviChatSessions.map((row) => [
      formatDate(row.startedAt),
      row.personName,
      row.sessionType,
      row.messagesExchanged,
      row.leadCaptured ? "Yes" : "No",
      row.language,
      row.sessionId,
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eduvi-chatbot-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportFeeCsv() {
    const header = ["Student", "University", "Fee Type", "Amount", "Currency", "Status", "Paid By", "Paid By Role", "Date"];
    const rows = filteredFeeRows.map((row) => [
      row.studentName,
      row.universityName,
      row.feeType,
      row.amount.toFixed(2),
      row.currency,
      row.status,
      row.paidBy || "-",
      row.paidByRole || "-",
      formatDate(row.date),
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `application-fees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function runRemindersNow() {
    setIsRunningReminders(true);
    setRunReminderMessage(null);

    try {
      const res = await fetch("/api/cron/visa-reminders", { method: "GET" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to run reminders");
      }

      const payload = json.data || {};
      setRunReminderMessage(
        `Run complete: scanned ${payload.scanned || 0}, reminders sent ${payload.remindersSent || 0}, tasks created ${payload.tasksCreated || 0}, duplicates skipped ${payload.duplicatesSkipped || 0}.`,
      );
    } catch (error) {
      setRunReminderMessage(error instanceof Error ? error.message : "Failed to run reminders");
    } finally {
      setIsRunningReminders(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-600 mt-1">Live analytics from the CRM database.</p>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Applications" && (
        <div className="space-y-6">
          <RecruitmentFunnelSection endpoint="/api/dashboard/funnel-stats" title="Recruitment Funnel" />

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Pipeline Funnel by Current Stage</h2>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={applicationPipelineCounts}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Stage-to-Stage Conversion</h2>
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">From</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Reached</th>
                  <th className="py-2 pr-4">Converted</th>
                  <th className="py-2">Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {applicationStageConversions.map((row) => (
                  <tr key={`${row.fromStage}-${row.toStage}`} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.fromLabel}</td>
                    <td className="py-2 pr-4">{row.toLabel}</td>
                    <td className="py-2 pr-4">{row.reached}</td>
                    <td className="py-2 pr-4">{row.converted}</td>
                    <td className="py-2">{row.conversionRate.toFixed(2)}%</td>
                  </tr>
                ))}
                {applicationStageConversions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">No conversion data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Average Stage Duration (Days)</h2>
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">From</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Sample Size</th>
                  <th className="py-2">Average Days</th>
                </tr>
              </thead>
              <tbody>
                {applicationStageDurations.map((row) => (
                  <tr key={`${row.fromStage}-${row.toStage}`} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.fromLabel}</td>
                    <td className="py-2 pr-4">{row.toLabel}</td>
                    <td className="py-2 pr-4">{row.sampleSize}</td>
                    <td className="py-2">{row.averageDays.toFixed(2)}</td>
                  </tr>
                ))}
                {applicationStageDurations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-slate-500">No duration data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === "Visa" && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Visa Appointment Reminders</h2>
                <p className="text-xs text-slate-600 mt-1">Trigger reminder run manually.</p>
              </div>
              <button
                onClick={runRemindersNow}
                disabled={isRunningReminders}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isRunningReminders ? "Running..." : "Run Reminder Now"}
              </button>
            </div>
            {runReminderMessage && <p className="mt-3 text-xs text-slate-700">{runReminderMessage}</p>}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Total Visa Applications by Status</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="status" width={140} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Visa Approval Rate by Destination Country</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Total Applied</th>
                  <th className="py-2 pr-4">Approved</th>
                  <th className="py-2 pr-4">Rejected</th>
                  <th className="py-2">Approval Rate %</th>
                </tr>
              </thead>
              <tbody>
                {countryApprovalRows.map((row) => (
                  <tr key={row.country} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.country}</td>
                    <td className="py-2 pr-4">{row.totalApplied}</td>
                    <td className="py-2 pr-4">{row.approved}</td>
                    <td className="py-2 pr-4">{row.rejected}</td>
                    <td className="py-2">{row.approvalRate.toFixed(2)}%</td>
                  </tr>
                ))}
                {countryApprovalRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">
                      No visa data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              Average Days from Visa Application to Decision
            </h2>
            <p className="text-3xl font-bold text-slate-900">{averageDaysToDecision.toFixed(2)} days</p>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Upcoming Appointments (Next 30 Days)
            </h2>
            <div className="space-y-2">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-md border border-slate-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                >
                  <p className="text-sm font-medium text-slate-900">{appointment.studentName}</p>
                  <p className="text-xs text-slate-600">{formatDate(appointment.date)}</p>
                  <p className="text-xs text-slate-600">{appointment.location}</p>
                </div>
              ))}
              {upcomingAppointments.length === 0 && (
                <p className="text-sm text-slate-500">No upcoming appointments in the next 30 days.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "Interview Tracking" && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Pre-CAS Required</p>
              <p className="text-2xl font-bold text-slate-900">{interviewSummary.preCasRequired}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Pre-CAS Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900">{interviewSummary.preCasPassRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Visa Required</p>
              <p className="text-2xl font-bold text-slate-900">{interviewSummary.visaRequired}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Visa Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900">{interviewSummary.visaPassRate.toFixed(2)}%</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Pre-CAS by Stage</h3>
              <div className="space-y-2 text-sm">
                {preCasStageBreakdown.map((row) => (
                  <div key={row.key} className="flex items-center justify-between"><span>{row.label}</span><span className="font-semibold">{row.count}</span></div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Pre-CAS Outcomes</h3>
              <div className="space-y-2 text-sm">
                {preCasOutcomeBreakdown.map((row) => (
                  <div key={row.key} className="flex items-center justify-between"><span>{row.label}</span><span className="font-semibold">{row.count}</span></div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Visa Outcomes</h3>
              <div className="space-y-2 text-sm">
                {visaOutcomeBreakdown.map((row) => (
                  <div key={row.key} className="flex items-center justify-between"><span>{row.label}</span><span className="font-semibold">{row.count}</span></div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">All Interviews</h3>
              <button onClick={exportInterviewCsv} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Export CSV</button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={interviewTypeFilter} onChange={(e) => setInterviewTypeFilter(e.target.value as "ALL" | "PRE_CAS" | "VISA")}>
                <option value="ALL">All Types</option>
                <option value="PRE_CAS">Pre-CAS</option>
                <option value="VISA">Visa</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="ALL">All Stages</option>
                {stageOptions.map((option) => <option key={option} value={option}>{formatStatusLabel(option)}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
                <option value="ALL">All Outcomes</option>
                {outcomeOptions.map((option) => <option key={option} value={option}>{formatStatusLabel(option)}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={counsellorFilter} onChange={(e) => setCounsellorFilter(e.target.value)}>
                <option value="ALL">All Counsellors</option>
                {counsellorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={subAgentFilter} onChange={(e) => setSubAgentFilter(e.target.value)}>
                <option value="ALL">All Sub-Agents</option>
                {subAgentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Student Name</th>
                    <th className="py-2 pr-4">University</th>
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Interview Type</th>
                    <th className="py-2 pr-4">Stage</th>
                    <th className="py-2 pr-4">Booked Date</th>
                    <th className="py-2 pr-4">Outcome</th>
                    <th className="py-2">Counsellor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterviewRows.map((row) => (
                    <tr key={`${row.applicationId}-${row.interviewType}`} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-900">{row.studentName}</td>
                      <td className="py-2 pr-4">{row.university}</td>
                      <td className="py-2 pr-4">{row.course}</td>
                      <td className="py-2 pr-4">{row.interviewType === "PRE_CAS" ? "Pre-CAS" : "Visa"}</td>
                      <td className="py-2 pr-4">{row.stage ? formatStatusLabel(row.stage) : "-"}</td>
                      <td className="py-2 pr-4">{row.bookedDate ? formatDate(row.bookedDate) : "-"}</td>
                      <td className="py-2 pr-4">{row.outcome ? formatStatusLabel(row.outcome) : "-"}</td>
                      <td className="py-2">{row.counsellor || "-"}</td>
                    </tr>
                  ))}
                  {filteredInterviewRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-slate-500">No interview records found for selected filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === "Mock Interviews" && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Completed Interviews</p>
              <p className="text-2xl font-bold text-slate-900">{mockCards.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900">{mockCards.passRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Need Support</p>
              <p className="text-2xl font-bold text-slate-900">{mockCards.support}</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Monthly Summary</h3>
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
                {mockInterviewMonthlyRows.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.month}</td>
                    <td className="py-2 pr-4">{row.completed}</td>
                    <td className="py-2 pr-4">{row.passed}</td>
                    <td className="py-2 pr-4">{row.failed}</td>
                    <td className="py-2">{row.passRate.toFixed(2)}%</td>
                  </tr>
                ))}
                {mockInterviewMonthlyRows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-slate-500">No monthly mock interview data available.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Per-Student Details</h3>
              <button onClick={exportMockInterviewCsv} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Export CSV</button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={mockMonthFilter} onChange={(e) => setMockMonthFilter(e.target.value)}>
                <option value="ALL">All Months</option>
                {mockMonthOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={mockCounsellorFilter} onChange={(e) => setMockCounsellorFilter(e.target.value)}>
                <option value="ALL">All Counsellors</option>
                {mockCounsellorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={mockSubAgentFilter} onChange={(e) => setMockSubAgentFilter(e.target.value)}>
                <option value="ALL">All Sub-Agents</option>
                {mockSubAgentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={mockResultFilter} onChange={(e) => setMockResultFilter(e.target.value as "ALL" | "PASS" | "FAIL")}>
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
                    <th className="py-2 pr-4">Sub-Agent</th>
                    <th className="py-2 text-right">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMockRows.map((row) => (
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
                      <td className="py-2 pr-4">{row.subAgent || "-"}</td>
                      <td className="py-2 text-right">
                        {row.reportDocumentUrl ? <a href={row.reportDocumentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a> : "-"}
                      </td>
                    </tr>
                  ))}
                  {filteredMockRows.length === 0 && (
                    <tr><td colSpan={10} className="py-4 text-slate-500">No mock interview records found for selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === "Commission" && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Revenue Summary</h2>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Total Gross</th>
                  <th className="py-2 pr-4">Total Agent Payouts</th>
                  <th className="py-2">Total EduQuantica Net</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">This Month</td>
                  <td className="py-2 pr-4">{money(commissionRevenueSummary.thisMonth.gross)}</td>
                  <td className="py-2 pr-4">{money(commissionRevenueSummary.thisMonth.agentPayouts)}</td>
                  <td className="py-2">{money(commissionRevenueSummary.thisMonth.eduquanticaNet)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">This Year</td>
                  <td className="py-2 pr-4">{money(commissionRevenueSummary.thisYear.gross)}</td>
                  <td className="py-2 pr-4">{money(commissionRevenueSummary.thisYear.agentPayouts)}</td>
                  <td className="py-2">{money(commissionRevenueSummary.thisYear.eduquanticaNet)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-900">All Time</td>
                  <td className="py-2 pr-4">{money(commissionRevenueSummary.allTime.gross)}</td>
                  <td className="py-2 pr-4">{money(commissionRevenueSummary.allTime.agentPayouts)}</td>
                  <td className="py-2">{money(commissionRevenueSummary.allTime.eduquanticaNet)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Top Earning Sub-Agents</h2>
            <table className="w-full text-sm min-w-[920px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Agency Name</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Students Enrolled</th>
                  <th className="py-2 pr-4">Total Earned</th>
                  <th className="py-2 pr-4">Total Paid</th>
                  <th className="py-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {topSubAgents.map((row) => (
                  <tr key={row.agencyName} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.agencyName}</td>
                    <td className="py-2 pr-4">{row.tier}</td>
                    <td className="py-2 pr-4">{row.studentsEnrolled}</td>
                    <td className="py-2 pr-4">{money(row.totalEarned)}</td>
                    <td className="py-2 pr-4">{money(row.totalPaid)}</td>
                    <td className="py-2">{money(row.outstanding)}</td>
                  </tr>
                ))}
                {topSubAgents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-slate-500">No sub-agent commission data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Top Universities by Commission</h2>
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">University</th>
                  <th className="py-2">Gross Commission Generated</th>
                </tr>
              </thead>
              <tbody>
                {topUniversities.map((row) => (
                  <tr key={row.universityName} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.universityName}</td>
                    <td className="py-2">{money(row.grossCommission)}</td>
                  </tr>
                ))}
                {topUniversities.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-slate-500">No university commission data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Commission by Destination Country</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commissionByCountry} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="country" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => money(Number(value || 0))} />
                  <Bar dataKey="grossCommission" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Monthly Trend (Gross vs Net)</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyCommissionTrend} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => money(Number(value || 0))} />
                  <Legend />
                  <Line type="monotone" dataKey="gross" stroke="#2563eb" strokeWidth={2} dot={false} name="Gross" />
                  <Line type="monotone" dataKey="net" stroke="#16a34a" strokeWidth={2} dot={false} name="Net" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {activeTab === "Scholarships" && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Tracked Applications</p>
              <p className="text-2xl font-bold text-slate-900">{scholarshipSummary.totalApplications}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Apply Rate</p>
              <p className="text-2xl font-bold text-slate-900">{scholarshipSummary.applyRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Award Rate</p>
              <p className="text-2xl font-bold text-slate-900">{scholarshipSummary.awardRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Awarded Amount</p>
              <p className="text-2xl font-bold text-slate-900">{money(scholarshipSummary.totalAwardedAmount)}</p>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Scholarship Status Distribution</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scholarshipStatusCounts.map((item) => ({ status: formatStatusLabel(item.status), count: item.count }))}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Monthly Scholarship Applications</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scholarshipMonthlyTrend} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="applications" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Top Universities by Scholarship Activity</h2>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">University</th>
                  <th className="py-2 pr-4">Applications</th>
                  <th className="py-2 pr-4">Awards</th>
                  <th className="py-2">Awarded Amount</th>
                </tr>
              </thead>
              <tbody>
                {topScholarshipUniversities.map((row) => (
                  <tr key={row.universityName} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.universityName}</td>
                    <td className="py-2 pr-4">{row.applications}</td>
                    <td className="py-2 pr-4">{row.awards}</td>
                    <td className="py-2">{money(row.awardedAmount)}</td>
                  </tr>
                ))}
                {topScholarshipUniversities.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-slate-500">No scholarship data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === "Application Fees" && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Total Fees Collected (This Month)</p>
              <p className="text-2xl font-bold text-slate-900">{money(applicationFeeSummary.totalCollectedThisMonth)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Total Fees Pending</p>
              <p className="text-2xl font-bold text-slate-900">{money(applicationFeeSummary.totalPending)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Total Fees Waived</p>
              <p className="text-2xl font-bold text-slate-900">{money(applicationFeeSummary.totalWaived)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">UCAS Grouped Payments</p>
              <p className="text-2xl font-bold text-slate-900">{applicationFeeSummary.ucasGroupedPaymentsCount}</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Application Fee Payments</h3>
              <button onClick={exportFeeCsv} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Export CSV</button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={feeStatusFilter} onChange={(e) => setFeeStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                {feeStatusOptions.map((status) => <option key={status} value={status}>{formatStatusLabel(status)}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={feeTypeFilter} onChange={(e) => setFeeTypeFilter(e.target.value)}>
                <option value="ALL">All Fee Types</option>
                {feeTypeOptions.map((type) => <option key={type} value={type}>{formatStatusLabel(type)}</option>)}
              </select>
              <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={feeDateFrom} onChange={(e) => setFeeDateFrom(e.target.value)} />
              <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={feeDateTo} onChange={(e) => setFeeDateTo(e.target.value)} />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">University</th>
                    <th className="py-2 pr-4">Fee Type</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Paid By</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeeRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-900">{row.studentName}</td>
                      <td className="py-2 pr-4">{row.universityName}</td>
                      <td className="py-2 pr-4">{formatStatusLabel(row.feeType)}</td>
                      <td className="py-2 pr-4">{money(row.amount, row.currency)}</td>
                      <td className="py-2 pr-4">{formatStatusLabel(row.status)}</td>
                      <td className="py-2 pr-4">{row.paidBy || "-"}</td>
                      <td className="py-2 pr-4">{row.paidByRole || "-"}</td>
                      <td className="py-2">{formatDate(row.date)}</td>
                    </tr>
                  ))}
                  {filteredFeeRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-slate-500">No fee payment records found for selected filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === "Academic Matching" && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Academic Profile Completion Rate</h2>
            <p className="text-3xl font-bold text-slate-900">{profileCompletionRate.toFixed(2)}%</p>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Eligibility Match Distribution</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={academicMatchDistribution} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Most Common Missing Subjects</h2>
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2">Missing Count</th>
                </tr>
              </thead>
              <tbody>
                {commonMissingSubjects.map((row) => (
                  <tr key={row.subject} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{row.subject}</td>
                    <td className="py-2">{row.count}</td>
                  </tr>
                ))}
                {commonMissingSubjects.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-slate-500">No missing subject data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Average Match Score by Nationality</h2>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgMatchScoreByNationality} margin={{ top: 8, right: 24, left: 8, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nationality" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={80} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="avgScore" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {activeTab === "Eduvi Chatbot" && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Sessions This Month</p>
              <p className="text-2xl font-bold text-slate-900">{eduviChatSummary.totalSessionsThisMonth}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Leads Captured</p>
              <p className="text-2xl font-bold text-slate-900">{eduviChatSummary.leadsCapturedThisMonth}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Lead Conversion</p>
              <p className="text-2xl font-bold text-slate-900">{eduviChatSummary.leadConversionRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Avg Session Duration</p>
              <p className="text-2xl font-bold text-slate-900">{eduviChatSummary.averageSessionDurationMinutes.toFixed(2)}m</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Languages Used</p>
              <p className="text-2xl font-bold text-slate-900">{eduviLanguageUsage.length}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Most Common Questions</h2>
              <div className="space-y-2 text-sm">
                {eduviCommonQuestions.map((item) => (
                  <div key={item.question} className="flex items-start justify-between gap-3 rounded border border-slate-100 px-3 py-2">
                    <span className="text-slate-700">{item.question}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                ))}
                {eduviCommonQuestions.length === 0 ? <p className="text-slate-500">No common question data yet.</p> : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Language Breakdown</h2>
              <div className="space-y-2 text-sm">
                {eduviLanguageUsage.map((item) => (
                  <div key={item.language} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                    <span className="text-slate-700">{item.language}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                ))}
                {eduviLanguageUsage.length === 0 ? <p className="text-slate-500">No language usage data yet.</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Chat Sessions</h2>
              <button onClick={exportEduviCsv} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Export CSV</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Date and Time</th>
                    <th className="py-2 pr-4">Visitor / Student</th>
                    <th className="py-2 pr-4">Session Type</th>
                    <th className="py-2 pr-4">Messages</th>
                    <th className="py-2 pr-4">Lead Captured</th>
                    <th className="py-2 pr-4">Language</th>
                    <th className="py-2">Transcript</th>
                  </tr>
                </thead>
                <tbody>
                  {eduviChatSessions.map((row) => (
                    <tr key={row.sessionId} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{formatDate(row.startedAt)}</td>
                      <td className="py-2 pr-4 font-medium text-slate-900">{row.personName}</td>
                      <td className="py-2 pr-4">{row.sessionType}</td>
                      <td className="py-2 pr-4">{row.messagesExchanged}</td>
                      <td className="py-2 pr-4">{row.leadCaptured ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4">{row.language}</td>
                      <td className="py-2">
                        <a href={`/api/chat/session/${row.sessionId}/history`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View transcript</a>
                      </td>
                    </tr>
                  ))}
                  {eduviChatSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-slate-500">No chat sessions found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
