"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type IntakeOption = {
  date: string;
  deadline?: string;
  status?: string;
};

type EligibilityInfo = {
  eligible: boolean;
  partiallyEligible: boolean;
  matchedRequirements: string[];
  missingRequirements: string[];
  message: string;
};

type SimilarCourse = {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  tuitionFee: number | null;
  currency: string;
  university: { name: string; country: string };
};

type CourseDetails = {
  id: string;
  name: string;
  level: string;
  tuitionFee: number | null;
  applicationFee: number | null;
  currency: string;
  intakeDatesWithDeadlines: IntakeOption[] | null;
  intakes: string[];
  university: { id: string; name: string; country: string; city: string };
};

type WizardData = {
  course: CourseDetails;
  eligibility: EligibilityInfo;
  similarPrograms: SimilarCourse[];
  studentName: string;
};

type Props = {
  courseId: string;
  onClose: () => void;
  onApplied: (applicationId: string) => void;
};

const STEPS = ["Intakes", "Prerequisites", "Backups", "What to Expect"] as const;

function money(amount: number | null | undefined, currency: string) {
  if (!amount) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function parseIntakes(course: CourseDetails): IntakeOption[] {
  if (Array.isArray(course.intakeDatesWithDeadlines) && course.intakeDatesWithDeadlines.length > 0) {
    return (course.intakeDatesWithDeadlines as IntakeOption[]).filter((i) => i.date);
  }
  if (course.intakes && course.intakes.length > 0) {
    return course.intakes.map((d) => ({ date: d }));
  }
  return [];
}

export default function ApplyWizardModal({ courseId, onClose, onApplied }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WizardData | null>(null);
  const [step, setStep] = useState(0);
  const [selectedIntake, setSelectedIntake] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [appliedAppId, setAppliedAppId] = useState<string | null>(null);
  const [feeRequired, setFeeRequired] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);
  const [feeCurrency, setFeeCurrency] = useState("GBP");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/student/courses/${courseId}`, { cache: "no-store" });
        const json = await res.json() as {
          data?: {
            course: CourseDetails;
            eligibility: EligibilityInfo;
            similarPrograms: SimilarCourse[];
            student: { id: string };
          };
          error?: string;
        };
        if (!res.ok || !json.data) throw new Error(json.error || "Failed to load course details");

        const sessionRes = await fetch("/api/auth/session");
        const sessionJson = await sessionRes.json() as { user?: { name?: string } };
        const studentName = sessionJson.user?.name || "Student";

        if (!cancelled) {
          setData({
            course: json.data.course,
            eligibility: json.data.eligibility,
            similarPrograms: json.data.similarPrograms || [],
            studentName,
          });
          const intakes = parseIntakes(json.data.course);
          if (intakes.length > 0) setSelectedIntake(intakes[0].date);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load course");
        if (!cancelled) onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, onClose]);

  async function handleApply() {
    if (!data) return;
    try {
      setApplying(true);
      const res = await fetch("/api/student/applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, intake: selectedIntake || undefined }),
      });
      const json = await res.json() as {
        data?: {
          applicationId: string;
          application?: { id: string };
          fee?: { feeRequired: boolean; amount: number; currency: string };
        };
        error?: string;
        existingApplicationId?: string;
      };

      if (res.status === 409) {
        toast.info(json.error || "You already have an active application for this course.");
        if (json.existingApplicationId) router.push(`/student/applications/${json.existingApplicationId}`);
        onClose();
        return;
      }

      if (!res.ok || !json.data) throw new Error(json.error || "Failed to create application");

      const appId = json.data.applicationId || json.data.application?.id || "";
      setAppliedAppId(appId);
      setFeeRequired(json.data.fee?.feeRequired ?? false);
      setFeeAmount(json.data.fee?.amount ?? 0);
      setFeeCurrency(json.data.fee?.currency ?? "GBP");
      setApplied(true);
      onApplied(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  function goToApp() {
    if (appliedAppId) router.push(`/student/applications/${appliedAppId}`);
    onClose();
  }

  function goToFee() {
    if (appliedAppId) router.push(`/student/applications/${appliedAppId}/fee?fromCreate=1`);
    onClose();
  }

  const intakes = data ? parseIntakes(data.course) : [];
  const selectedIntakeInfo = intakes.find((i) => i.date === selectedIntake);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500 text-center">Loading course details…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">New Application</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 transition">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                      applied
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : i < step
                        ? "bg-blue-600 border-blue-600 text-white"
                        : i === step
                        ? "bg-white border-blue-600 text-blue-600"
                        : "bg-white border-slate-300 text-slate-400"
                    }`}
                  >
                    {i < step || applied ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i === step && !applied ? "text-blue-600" : "text-slate-400"}`}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mb-4 transition-colors ${i < step ? "bg-blue-600" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {/* Applied success state */}
          {applied ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-900">Application submitted!</p>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {data.course.name} at {data.course.university.name}
                  </p>
                </div>
              </div>

              {feeRequired && feeAmount > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">Application fee required</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        An application fee of <strong>{money(feeAmount, feeCurrency)}</strong> is due. Your counsellor has been notified. You can pay now or continue and pay later.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={goToFee}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition"
                    >
                      Pay Now
                    </button>
                    <button
                      onClick={goToApp}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Pay Later
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Info className="h-4 w-4 text-slate-400" />
                    No application fee required for this course.
                  </div>
                </div>
              )}
            </div>
          ) : step === 0 ? (
            // Step 1: Intakes
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="font-medium text-slate-500">Program</span>
                  <span className="text-slate-900">{data.course.name}</span>
                  <span className="font-medium text-slate-500">School</span>
                  <span className="text-slate-900">{data.course.university.name}</span>
                  <span className="font-medium text-slate-500">Student</span>
                  <span className="text-slate-900">{data.studentName}</span>
                  {selectedIntake && (
                    <>
                      <span className="font-medium text-slate-500">Intake</span>
                      <span className="text-slate-900">{selectedIntake}</span>
                    </>
                  )}
                  {selectedIntakeInfo?.deadline && (
                    <>
                      <span className="font-medium text-slate-500">Deadline</span>
                      <span className="text-slate-900 flex items-center gap-1">
                        {selectedIntakeInfo.deadline}
                        <Info className="h-3.5 w-3.5 text-slate-400" />
                      </span>
                    </>
                  )}
                </div>
              </div>

              {intakes.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Select the academic intake:
                  </label>
                  <select
                    value={selectedIntake}
                    onChange={(e) => setSelectedIntake(e.target.value)}
                    className="w-full rounded-xl border-2 border-blue-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  >
                    {intakes.map((intake) => (
                      <option key={intake.date} value={intake.date}>
                        {intake.date}{intake.status ? ` · ${intake.status}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  No specific intakes listed. Your counsellor will confirm the intake with the university.
                </div>
              )}
            </div>
          ) : step === 1 ? (
            // Step 2: Prerequisites
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Here&apos;s how your profile matches the entry requirements for this course.
              </p>
              {data.eligibility.matchedRequirements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Requirements met</p>
                  {data.eligibility.matchedRequirements.map((r) => (
                    <div key={r} className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-emerald-800">{r}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.eligibility.missingRequirements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Missing or unverified</p>
                  {data.eligibility.missingRequirements.map((r) => (
                    <div key={r} className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-amber-800">{r}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.eligibility.matchedRequirements.length === 0 && data.eligibility.missingRequirements.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  {data.eligibility.message || "Complete your academic profile to see eligibility details."}
                </div>
              )}
              <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                data.eligibility.eligible
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : data.eligibility.partiallyEligible
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-slate-50 text-slate-700 border border-slate-200"
              }`}>
                {data.eligibility.eligible ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Info className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                {data.eligibility.message || "You can still apply — your counsellor will review your profile."}
              </div>
            </div>
          ) : step === 2 ? (
            // Step 3: Backups
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Consider these similar programs at other universities as alternatives or backups.
              </p>
              {data.similarPrograms.length > 0 ? (
                <div className="space-y-2">
                  {data.similarPrograms.slice(0, 4).map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.university.name} · {p.university.country}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-700">
                        {p.tuitionFee ? money(p.tuitionFee, p.currency) : "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No similar programs found at this time.
                </div>
              )}
              <p className="text-xs text-slate-400">You can apply to multiple programs independently from the course search page.</p>
            </div>
          ) : (
            // Step 4: What to Expect
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Once you apply, here&apos;s what the process looks like:
              </p>
              <ol className="space-y-3">
                {[
                  { step: "Application Submitted", desc: "Your counsellor will review and verify your documents." },
                  { step: "Submitted to University", desc: "Your counsellor forwards your application to the university." },
                  { step: "Offer Received", desc: "The university responds with a conditional or unconditional offer." },
                  { step: "Finance", desc: "You pay your tuition deposit and complete your financial documents." },
                  { step: "CAS & Visa", desc: "Your CAS letter is issued and you apply for your visa." },
                  { step: "Enrolled", desc: "You confirm your enrolment and join the program." },
                ].map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.step}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tuition fee</span>
                  <span className="font-medium text-slate-900">{money(data.course.tuitionFee, data.course.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Application fee</span>
                  <span className={`font-medium ${data.course.applicationFee ? "text-amber-700" : "text-emerald-700"}`}>
                    {data.course.applicationFee ? money(data.course.applicationFee, data.course.currency) : "Free"}
                  </span>
                </div>
                {selectedIntake && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selected intake</span>
                    <span className="font-medium text-slate-900">{selectedIntake}</span>
                  </div>
                )}
              </div>

              {data.course.applicationFee != null && data.course.applicationFee > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-amber-800">
                    An application fee of <strong>{money(data.course.applicationFee, data.course.currency)}</strong> applies. You can pay after submitting your application.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!applied && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" />
              Cancel
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void handleApply()}
                disabled={applying}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply Now →
              </button>
            )}
          </div>
        )}

        {applied && (
          <div className="flex justify-end px-6 py-4 border-t border-slate-200">
            <button
              onClick={goToApp}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              View Application →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
