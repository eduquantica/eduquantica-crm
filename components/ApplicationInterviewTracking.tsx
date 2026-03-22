"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, IdCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

type PreCasStage = "BEFORE_OFFER" | "AFTER_CONDITIONAL_OFFER" | "DURING_CAS_ISSUE";
type InterviewOutcome = "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED_BY_UNIVERSITY" | "NO_SHOW";

type InterviewRecord = {
  id: string;
  isRequired: boolean;
  stage?: PreCasStage | null;
  location?: string | null;
  bookedDate?: string | null;
  outcome?: InterviewOutcome | null;
  outcomeDate?: string | null;
  outcomeNotes?: string | null;
  rescheduledDate?: string | null;
  cancelledReason?: string | null;
  lastUpdatedByName?: string;
  lastUpdatedAt?: string;
};

type Props = {
  applicationId: string;
  roleName: string;
};

const OUTCOMES: Array<{ value: InterviewOutcome; label: string }> = [
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "CANCELLED_BY_UNIVERSITY", label: "Cancelled by University" },
  { value: "NO_SHOW", label: "No Show" },
];

const STAGES: Array<{ value: PreCasStage; label: string }> = [
  { value: "BEFORE_OFFER", label: "Before Offer Letter" },
  { value: "AFTER_CONDITIONAL_OFFER", label: "After Conditional Offer" },
  { value: "DURING_CAS_ISSUE", label: "During CAS Issue" },
];

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toApiDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function countdownLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) return `Interview in ${diffDays} days`;
  if (diffDays === 1) return "Interview tomorrow";
  return `Interview was on ${date.toLocaleDateString("en-GB")}`;
}

function isDatePassed(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function LastUpdated({ row }: { row: InterviewRecord | null }) {
  if (!row?.lastUpdatedAt) return null;
  return (
    <p className="mt-4 text-xs text-slate-500">
      Last updated by {row.lastUpdatedByName || "System"} on {new Date(row.lastUpdatedAt).toLocaleString("en-GB")}
    </p>
  );
}

export default function ApplicationInterviewTracking({ applicationId, roleName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preCas, setPreCas] = useState<InterviewRecord | null>(null);
  const [visa, setVisa] = useState<InterviewRecord | null>(null);

  const isStudent = roleName === "STUDENT";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [preRes, visaRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}/pre-cas-interview`, { cache: "no-store" }),
        fetch(`/api/applications/${applicationId}/visa-interview`, { cache: "no-store" }),
      ]);

      const [preJson, visaJson] = await Promise.all([preRes.json(), visaRes.json()]);
      if (!preRes.ok) throw new Error(preJson.error || "Failed to load Pre-CAS interview");
      if (!visaRes.ok) throw new Error(visaJson.error || "Failed to load Visa interview");
      setPreCas(preJson.data || null);
      setVisa(visaJson.data || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load interview tracking");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function patch(endpoint: "pre-cas-interview" | "visa-interview", payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/${endpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      if (endpoint === "pre-cas-interview") setPreCas(json.data);
      else setVisa(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const preCasCountdown = useMemo(() => countdownLabel(preCas?.bookedDate), [preCas?.bookedDate]);
  const visaCountdown = useMemo(() => countdownLabel(visa?.bookedDate), [visa?.bookedDate]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading interview tracking...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <details open className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900">
          <Building2 className="h-4 w-4 text-slate-600" />
          Pre-CAS University Interview
        </summary>

        {isStudent && (
          <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Received an interview request? Tick the box and add the date so your counsellor is notified.
          </p>
        )}

        <div className="mt-3 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-slate-700">Interview Required</p>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!preCas?.isRequired}
                disabled={saving}
                onChange={(e) => void patch("pre-cas-interview", { isRequired: e.target.checked })}
              />
              <span>{preCas?.isRequired ? "Yes" : "No"}</span>
            </label>
          </div>

          {!preCas?.isRequired ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">No Pre-CAS interview required for this application</p>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2 md:items-center">
                <label className="text-slate-700">Interview Stage</label>
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={preCas?.stage || ""}
                  disabled={saving}
                  onChange={(e) => void patch("pre-cas-interview", { stage: e.target.value || null })}
                >
                  <option value="">Select stage</option>
                  {STAGES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 md:grid-cols-2 md:items-center">
                <label className="text-slate-700">Booked Interview Date</label>
                <input
                  type="datetime-local"
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={toInputDateTime(preCas?.bookedDate)}
                  disabled={saving}
                  onChange={(e) => void patch("pre-cas-interview", { bookedDate: toApiDateTime(e.target.value) })}
                />
              </div>

              {preCasCountdown && (
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {preCasCountdown}
                </span>
              )}

              {isDatePassed(preCas?.bookedDate) && (
                <>
                  <div className="grid gap-2 md:grid-cols-2 md:items-center">
                    <label className="text-slate-700">Interview Outcome</label>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2"
                      value={preCas?.outcome || ""}
                      disabled={saving || isStudent}
                      onChange={(e) => void patch("pre-cas-interview", { outcome: e.target.value || null })}
                    >
                      <option value="">Select outcome</option>
                      {OUTCOMES.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  {!!preCas?.outcome && (
                    <div className="grid gap-2 md:grid-cols-2 md:items-start">
                      <label className="text-slate-700">Notes</label>
                      <textarea
                        className="rounded-md border border-slate-300 px-3 py-2"
                        rows={3}
                        defaultValue={preCas?.outcomeNotes || ""}
                        disabled={saving || isStudent}
                        onBlur={(e) => void patch("pre-cas-interview", { outcomeNotes: e.target.value || null })}
                      />
                    </div>
                  )}

                  {preCas?.outcome === "RESCHEDULED" && (
                    <div className="grid gap-2 md:grid-cols-2 md:items-center">
                      <label className="text-slate-700">New Interview Date</label>
                      <input
                        type="datetime-local"
                        className="rounded-md border border-slate-300 px-3 py-2"
                        value={toInputDateTime(preCas?.rescheduledDate)}
                        disabled={saving || isStudent}
                        onChange={(e) => void patch("pre-cas-interview", { rescheduledDate: toApiDateTime(e.target.value) })}
                      />
                    </div>
                  )}

                  {preCas?.outcome === "CANCELLED_BY_UNIVERSITY" && (
                    <div className="grid gap-2 md:grid-cols-2 md:items-center">
                      <label className="text-slate-700">Cancellation Reason</label>
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2"
                        defaultValue={preCas?.cancelledReason || ""}
                        disabled={saving || isStudent}
                        onBlur={(e) => void patch("pre-cas-interview", { cancelledReason: e.target.value || null })}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <LastUpdated row={preCas} />
      </details>

      <details open className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900">
          <IdCard className="h-4 w-4 text-slate-600" />
          Visa Interview
        </summary>

        {isStudent && (
          <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Received an interview request? Tick the box and add the date so your counsellor is notified.
          </p>
        )}

        <div className="mt-3 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-slate-700">Interview Required</p>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!visa?.isRequired}
                disabled={saving}
                onChange={(e) => void patch("visa-interview", { isRequired: e.target.checked })}
              />
              <span>{visa?.isRequired ? "Yes" : "No"}</span>
            </label>
          </div>

          {!visa?.isRequired ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">No Visa interview required for this application</p>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2 md:items-center">
                <label className="text-slate-700">Interview Location</label>
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  defaultValue={visa?.location || ""}
                  disabled={saving}
                  onBlur={(e) => void patch("visa-interview", { location: e.target.value || null })}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2 md:items-center">
                <label className="text-slate-700">Booked Interview Date</label>
                <input
                  type="datetime-local"
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={toInputDateTime(visa?.bookedDate)}
                  disabled={saving}
                  onChange={(e) => void patch("visa-interview", { bookedDate: toApiDateTime(e.target.value) })}
                />
              </div>

              {visaCountdown && (
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {visaCountdown}
                </span>
              )}

              {isDatePassed(visa?.bookedDate) && (
                <>
                  <div className="grid gap-2 md:grid-cols-2 md:items-center">
                    <label className="text-slate-700">Interview Outcome</label>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2"
                      value={visa?.outcome || ""}
                      disabled={saving || isStudent}
                      onChange={(e) => void patch("visa-interview", { outcome: e.target.value || null })}
                    >
                      <option value="">Select outcome</option>
                      {OUTCOMES.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  {!!visa?.outcome && (
                    <div className="grid gap-2 md:grid-cols-2 md:items-start">
                      <label className="text-slate-700">Notes</label>
                      <textarea
                        className="rounded-md border border-slate-300 px-3 py-2"
                        rows={3}
                        defaultValue={visa?.outcomeNotes || ""}
                        disabled={saving || isStudent}
                        onBlur={(e) => void patch("visa-interview", { outcomeNotes: e.target.value || null })}
                      />
                    </div>
                  )}

                  {visa?.outcome === "RESCHEDULED" && (
                    <div className="grid gap-2 md:grid-cols-2 md:items-center">
                      <label className="text-slate-700">New Interview Date</label>
                      <input
                        type="datetime-local"
                        className="rounded-md border border-slate-300 px-3 py-2"
                        value={toInputDateTime(visa?.rescheduledDate)}
                        disabled={saving || isStudent}
                        onChange={(e) => void patch("visa-interview", { rescheduledDate: toApiDateTime(e.target.value) })}
                      />
                    </div>
                  )}

                  {visa?.outcome === "CANCELLED_BY_UNIVERSITY" && (
                    <div className="grid gap-2 md:grid-cols-2 md:items-center">
                      <label className="text-slate-700">Cancellation Reason</label>
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2"
                        defaultValue={visa?.cancelledReason || ""}
                        disabled={saving || isStudent}
                        onBlur={(e) => void patch("visa-interview", { cancelledReason: e.target.value || null })}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <LastUpdated row={visa} />
      </details>
    </div>
  );
}
