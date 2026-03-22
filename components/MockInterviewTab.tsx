"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, UploadCloud } from "lucide-react";
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

type Props = {
  applicationId?: string;
  listEndpoint: string;
  canAssign: boolean;
  assignButtonLabel?: string;
  scope: "dashboard" | "agent";
};

const INTERVIEW_TYPES = [
  { value: "PRE_CAS_UNIVERSITY", label: "Pre-CAS University" },
  { value: "UK_VISA", label: "UK Visa" },
  { value: "US_VISA", label: "US Visa" },
  { value: "CANADA_STUDY_PERMIT", label: "Canada Study Permit" },
  { value: "AUSTRALIA_STUDENT_VISA", label: "Australia Student Visa" },
  { value: "GENERAL_PREPARATION", label: "General Preparation" },
] as const;

export default function MockInterviewTab({
  applicationId,
  listEndpoint,
  canAssign,
  assignButtonLabel = "Assign Mock Interview",
  scope,
}: Props) {
  const [rows, setRows] = useState<MockInterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

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

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEndpoint]);

  async function handleAssign() {
    if (!applicationId) return;

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
          applicationId,
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

      toast.success("Mock interview assigned successfully");
      setAssignOpen(false);
      setOfferLetterFile(null);
      setCourseUrl("");
      setUniversityAboutUrl("");
      setUniversityAboutText("");
      setSampleQuestionsUrl("");
      setSampleQuestionsText("");
      setCustomInstructions("");
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign mock interview");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Mock Interview</h3>
          <p className="text-xs text-slate-500">Manage attempts and reports in {titleLabel} scope.</p>
        </div>
        {canAssign && applicationId && (
          <button
            type="button"
            onClick={() => setAssignOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> {assignButtonLabel}
          </button>
        )}
      </div>

      {assignOpen && canAssign && applicationId && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Interview Type</label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {INTERVIEW_TYPES.map((row) => (
                  <option key={row.value} value={row.value}>{row.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Passing Score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value || 80))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Offer Letter Upload</label>
            <div className="flex items-center gap-2">
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)} />
              <UploadCloud className="h-4 w-4 text-slate-500" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Course Info URL</label>
              <input value={courseUrl} onChange={(e) => setCourseUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">University Info URL</label>
              <input value={universityAboutUrl} onChange={(e) => setUniversityAboutUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">University Info Text (optional)</label>
            <textarea value={universityAboutText} onChange={(e) => setUniversityAboutText(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sample Questions URL</label>
              <input value={sampleQuestionsUrl} onChange={(e) => setSampleQuestionsUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Custom Instructions</label>
              <input value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Focus points for this student" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sample Questions Text (optional)</label>
            <textarea value={sampleQuestionsText} onChange={(e) => setSampleQuestionsText(e.target.value)} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={assigning}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm Assignment
            </button>
            <button type="button" onClick={() => setAssignOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-600"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading attempts...</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">No mock interview attempts found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Attempt</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Completed</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const result = row.report?.isPassed ?? (typeof row.overallScore === "number" ? row.overallScore >= 80 : null);
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">#{row.attemptNumber}</td>
                    <td className="px-3 py-2 text-slate-700">{row.interviewType}</td>
                    <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{row.status}</span></td>
                    <td className="px-3 py-2">{typeof row.overallScore === "number" ? `${row.overallScore.toFixed(2)}%` : "-"}</td>
                    <td className="px-3 py-2">
                      {result === null ? "-" : (
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${result ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {result ? "PASS" : "FAIL"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{new Date(row.assignedAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-3 py-2 text-slate-600">{row.completedAt ? new Date(row.completedAt).toLocaleDateString("en-GB") : "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        {row.reportDocumentUrl && (
                          <a href={row.reportDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-700 hover:underline">Download</a>
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
