"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

type MockInterviewRow = {
  id: string;
  interviewType: string;
  status: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attemptNumber: number;
  overallScore: number | null;
  recommendation: string | null;
  reportDocumentUrl: string | null;
  assignedBy?: { id: string; name: string | null; email: string } | null;
  report?: {
    overallScore: number;
    isPassed: boolean;
    recommendation: string;
    generatedAt: string;
  } | null;
  application?: {
    id: string;
    course: { name: string; university: { name: string; country: string } };
  };
};

type ApplicationOption = {
  id: string;
  status: string;
  course: { name: string } | null;
  university: { name: string } | null;
};

type Props = {
  /** Pass when the tab is embedded on a specific application page */
  applicationId?: string;
  /** Pass when the tab is embedded on a student profile page — allows selecting which application */
  studentId?: string;
  listEndpoint: string;
  canAssign: boolean;
  assignButtonLabel?: string;
  scope: "dashboard" | "agent";
};

const INTERVIEW_TYPES = [
  { value: "PRE_CAS_UNIVERSITY", label: "Pre-CAS University Interview" },
  { value: "UK_VISA", label: "UK Student Visa Interview" },
  { value: "US_VISA", label: "US F-1 Visa Interview" },
  { value: "CANADA_STUDY_PERMIT", label: "Canada Study Permit Interview" },
  { value: "AUSTRALIA_STUDENT_VISA", label: "Australia Student Visa Interview" },
  { value: "GENERAL_PREPARATION", label: "General Preparation" },
] as const;

const STATUS_COLOURS: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-slate-100 text-slate-500",
};

export default function MockInterviewTab({
  applicationId: applicationIdProp,
  studentId,
  listEndpoint,
  canAssign,
  assignButtonLabel = "Assign Mock Interview",
  scope,
}: Props) {
  const [rows, setRows] = useState<MockInterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Application selection (used when no applicationId prop is provided)
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");

  // Form fields
  const [interviewType, setInterviewType] = useState<string>("PRE_CAS_UNIVERSITY");
  const [passingScore, setPassingScore] = useState<number>(80);
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  const [courseUrl, setCourseUrl] = useState("");
  const [universityAboutUrl, setUniversityAboutUrl] = useState("");
  const [universityAboutText, setUniversityAboutText] = useState("");
  const [sampleQuestionsUrl, setSampleQuestionsUrl] = useState("");
  const [sampleQuestionsText, setSampleQuestionsText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  const titleLabel = useMemo(() => (scope === "dashboard" ? "dashboard" : "agent portal"), [scope]);

  // The effective applicationId: from prop (app detail page) or from selector (student page)
  const effectiveAppId = applicationIdProp || selectedAppId;
  const needsAppSelection = !applicationIdProp && canAssign;

  async function loadRows() {
    try {
      setLoading(true);
      const res = await fetch(listEndpoint, { cache: "no-store" });
      const json = (await res.json()) as { data?: MockInterviewRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load mock interviews");
      setRows(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load mock interviews");
    } finally {
      setLoading(false);
    }
  }

  async function loadApplications() {
    if (!studentId) return;
    setLoadingApps(true);
    try {
      const res = await fetch(`/api/dashboard/applications?studentId=${studentId}`);
      const json = await res.json() as { data?: ApplicationOption[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load applications");
      setApplications(json.data || []);
    } catch {
      // silently fail — user will see empty dropdown
    } finally {
      setLoadingApps(false);
    }
  }

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEndpoint]);

  function openAssignForm() {
    setAssignOpen(true);
    if (needsAppSelection && applications.length === 0) {
      void loadApplications();
    }
  }

  function closeAssignForm() {
    setAssignOpen(false);
    setSelectedAppId("");
    setOfferLetterFile(null);
    setCourseUrl("");
    setUniversityAboutUrl("");
    setUniversityAboutText("");
    setSampleQuestionsUrl("");
    setSampleQuestionsText("");
    setCustomInstructions("");
  }

  async function handleAssign() {
    if (!effectiveAppId) {
      toast.error("Please select an application first");
      return;
    }

    try {
      setAssigning(true);

      let offerLetterUrl = "";
      if (offerLetterFile) {
        const formData = new FormData();
        formData.append("files", offerLetterFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string };
        if (!uploadRes.ok || !uploadJson.urls?.[0]) {
          throw new Error(uploadJson.error || "Offer letter upload failed");
        }
        offerLetterUrl = uploadJson.urls[0];
      }

      const res = await fetch("/api/counsellor/mock-interview/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: effectiveAppId,
          interviewType,
          passingScore,
          offerLetterUrl,
          courseUrl,
          universityAboutUrl,
          universityAboutText,
          sampleQuestionsUrl,
          sampleQuestionsText,
          customInstructions,
        }),
      });

      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to assign mock interview");

      toast.success("Mock interview assigned — student has been notified.");
      closeAssignForm();
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign mock interview");
    } finally {
      setAssigning(false);
    }
  }

  const selectedApp = applications.find((a) => a.id === selectedAppId);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Mock Interview</h3>
          <p className="text-xs text-slate-500">Manage attempts and reports in {titleLabel} scope.</p>
        </div>
        {canAssign && (applicationIdProp || studentId) && !assignOpen && (
          <button
            type="button"
            onClick={openAssignForm}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
            style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}
          >
            <Plus className="h-4 w-4" /> {assignButtonLabel}
          </button>
        )}
      </div>

      {/* Assignment Form */}
      {assignOpen && canAssign && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1B2A4A]">New Mock Interview Assignment</h4>
            <button type="button" onClick={closeAssignForm} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Application selector — shown only when no applicationId prop */}
          {needsAppSelection && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Select Application <span className="text-red-500">*</span>
              </label>
              {loadingApps ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading applications…
                </div>
              ) : applications.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No applications found for this student. Create an application first.
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    <option value="">— Choose an application —</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.course?.name || "Unknown Course"} — {app.university?.name || "Unknown University"} ({app.status})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              )}
              {selectedApp && (
                <p className="mt-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                  ✓ Finance data and application context will be automatically pulled for this application.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Interview Type</label>
              <div className="relative">
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700"
                >
                  {INTERVIEW_TYPES.map((row) => (
                    <option key={row.value} value={row.value}>{row.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Passing Score (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value || 80))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"
              />
            </div>
          </div>

          {/* URL inputs — side by side */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              📎 Study Material URLs — Claude will scrape these automatically
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  University About Page URL
                </label>
                <input
                  value={universityAboutUrl}
                  onChange={(e) => setUniversityAboutUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
                  placeholder="https://www.university.ac.uk/about"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Course Page URL
                </label>
                <input
                  value={courseUrl}
                  onChange={(e) => setCourseUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
                  placeholder="https://www.university.ac.uk/courses/msc-data-science"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Sample Questions or Additional Resource URL (optional)
              </label>
              <input
                value={sampleQuestionsUrl}
                onChange={(e) => setSampleQuestionsUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
                placeholder="https://..."
              />
            </div>
            <p className="text-[11px] text-blue-600">
              The system will scrape all URLs and inject the content into the interview so Claude can ask university-specific, course-specific, and finance-specific questions.
            </p>
          </div>

          {/* Offer Letter upload */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Offer Letter Upload (optional — PDF or image)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <UploadCloud className="h-4 w-4 text-slate-400" />
                {offerLetterFile ? offerLetterFile.name : "Choose file…"}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                />
              </label>
              {offerLetterFile && (
                <button
                  type="button"
                  onClick={() => setOfferLetterFile(null)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Manual text overrides */}
          <details className="group">
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-600 hover:text-slate-900 list-none flex items-center gap-1">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              Manual text overrides (optional — paste content if URLs are blocked)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">University / Course Info (paste manually)</label>
                <textarea
                  value={universityAboutText}
                  onChange={(e) => setUniversityAboutText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  placeholder="Paste university or course description here…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Sample Questions Text</label>
                <textarea
                  value={sampleQuestionsText}
                  onChange={(e) => setSampleQuestionsText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  placeholder="Paste sample interview questions here…"
                />
              </div>
            </div>
          </details>

          {/* Custom instructions */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Additional Instructions for Claude (optional)
            </label>
            <input
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              placeholder="e.g. Focus on financial questions, student has a scholarship concern…"
            />
          </div>

          {/* Finance auto-pull notice */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            💳 <strong>Finance data auto-included:</strong> Deposit paid, remaining tuition, bank account balances, and declared funding sources will be automatically pulled from the student&apos;s finance tab and injected as interview context — no manual entry needed.
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={assigning || (needsAppSelection && !selectedAppId)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {assigning ? "Assigning…" : "Confirm Assignment"}
            </button>
            <button
              type="button"
              onClick={closeAssignForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attempts table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-600">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading attempts…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No mock interview attempts yet.
            {canAssign && (applicationIdProp || studentId) && (
              <span className="block mt-1 text-xs text-slate-400">Use the button above to assign the first attempt.</span>
            )}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                <th className="px-3 py-2.5">Attempt</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Score</th>
                <th className="px-3 py-2.5">Result</th>
                <th className="px-3 py-2.5">Assigned</th>
                <th className="px-3 py-2.5">Completed</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const result =
                  row.report?.isPassed ??
                  (typeof row.overallScore === "number" ? row.overallScore >= 80 : null);
                const statusCls = STATUS_COLOURS[row.status] || "bg-slate-100 text-slate-600";
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-700">#{row.attemptNumber}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">
                      {INTERVIEW_TYPES.find((t) => t.value === row.interviewType)?.label || row.interviewType}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {typeof row.overallScore === "number" ? `${row.overallScore.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {result === null ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${result ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {result ? "PASS" : "FAIL"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">
                      {new Date(row.assignedAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">
                      {row.completedAt ? new Date(row.completedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-2">
                        {row.reportDocumentUrl && (
                          <a
                            href={row.reportDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-[#1B2A4A] hover:underline"
                          >
                            Download Report
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
