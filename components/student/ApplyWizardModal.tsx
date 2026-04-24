"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Sparkles,
  CalendarDays,
  GraduationCap,
  BookOpen,
  Rocket,
  MapPin,
  Zap,
  TrendingUp,
  ArrowRight,
  ChevronLeft,
  BadgeCheck,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";

type IntakeOption = { date: string; deadline?: string; status?: string };
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
type Props = { courseId: string; onClose: () => void; onApplied: (applicationId: string) => void };

const STEPS = [
  { id: "intake",   label: "Start Date",    icon: CalendarDays,  emoji: "📅" },
  { id: "prereqs",  label: "Eligibility",   icon: GraduationCap, emoji: "🎯" },
  { id: "backups",  label: "Alternatives",  icon: BookOpen,      emoji: "🔄" },
  { id: "journey",  label: "Your Journey",  icon: Rocket,        emoji: "🚀" },
] as const;

function money(amount: number | null | undefined, currency: string) {
  if (!amount) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function parseIntakes(course: CourseDetails): IntakeOption[] {
  if (Array.isArray(course.intakeDatesWithDeadlines) && course.intakeDatesWithDeadlines.length > 0) {
    return (course.intakeDatesWithDeadlines as IntakeOption[]).filter((i) => i.date);
  }
  if (course.intakes?.length > 0) return course.intakes.map((d) => ({ date: d }));
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
        const [courseRes, sessionRes] = await Promise.all([
          fetch(`/api/student/courses/${courseId}`, { cache: "no-store" }),
          fetch("/api/auth/session"),
        ]);
        const courseJson = await courseRes.json() as {
          data?: { course: CourseDetails; eligibility: EligibilityInfo; similarPrograms: SimilarCourse[] };
          error?: string;
        };
        if (!courseRes.ok || !courseJson.data) throw new Error(courseJson.error || "Couldn't load course");
        const sessionJson = await sessionRes.json() as { user?: { name?: string } };
        if (!cancelled) {
          setData({
            course: courseJson.data.course,
            eligibility: courseJson.data.eligibility,
            similarPrograms: courseJson.data.similarPrograms || [],
            studentName: sessionJson.user?.name || "Student",
          });
          const intakes = parseIntakes(courseJson.data.course);
          if (intakes.length > 0) setSelectedIntake(intakes[0].date);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
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
        data?: { applicationId: string; application?: { id: string }; fee?: { feeRequired: boolean; amount: number; currency: string } };
        error?: string;
        existingApplicationId?: string;
      };
      if (res.status === 409) {
        toast.info("You already have an active application for this one!");
        if (json.existingApplicationId) router.push(`/student/applications/${json.existingApplicationId}`);
        onClose();
        return;
      }
      if (!res.ok || !json.data) throw new Error(json.error || "Application failed");
      const appId = json.data.applicationId || json.data.application?.id || "";
      setAppliedAppId(appId);
      setFeeRequired(json.data.fee?.feeRequired ?? false);
      setFeeAmount(json.data.fee?.amount ?? 0);
      setFeeCurrency(json.data.fee?.currency ?? "GBP");
      setApplied(true);
      onApplied(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setApplying(false);
    }
  }

  const intakes = data ? parseIntakes(data.course) : [];
  const selectedIntakeInfo = intakes.find((i) => i.date === selectedIntake);
  const progress = applied ? 100 : (step / (STEPS.length - 1)) * 100;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
        <div className="rounded-3xl bg-white p-10 shadow-2xl flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <Sparkles className="h-7 w-7 text-white animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-900 text-lg">Getting things ready</p>
            <p className="text-sm text-slate-400 mt-1">Loading your course details…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl shadow-slate-900/20 flex flex-col max-h-[92vh] overflow-hidden">

        {/* Gradient header band */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 pt-5 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-violet-200" />
                <span className="text-xs font-semibold text-violet-200 uppercase tracking-widest">New Application</span>
              </div>
              <h2 className="text-xl font-bold text-white leading-tight line-clamp-1">{data.course.name}</h2>
              <p className="text-sm text-indigo-200 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {data.course.university.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition text-white mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step pills */}
          <div className="flex gap-1.5 pb-4">
            {STEPS.map((s, i) => {
              const done = applied || i < step;
              const active = !applied && i === step;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    done
                      ? "bg-white/20 text-white"
                      : active
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {done && !active ? <CheckCircle2 className="h-3 w-3" /> : <span>{s.emoji}</span>}
                  {s.label}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full bg-white/20 rounded-full -mx-6 px-0" style={{ marginBottom: 0 }}>
            <div
              className="h-1 bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── SUCCESS STATE ─────────────────────────────── */}
          {applied ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-5 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <p className="text-lg font-bold text-emerald-900">You&apos;re in the queue! 🎉</p>
                <p className="text-sm text-emerald-600 mt-1">
                  Application submitted for <span className="font-semibold">{data.course.name}</span>.<br />
                  Your counsellor will pick this up shortly.
                </p>
              </div>

              {feeRequired && feeAmount > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow shadow-amber-200">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900">One thing left 👀</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        There&apos;s a <strong>{money(feeAmount, feeCurrency)}</strong> application fee to keep things moving. Your counsellor&apos;s already been notified.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (appliedAppId) router.push(`/student/applications/${appliedAppId}/fee?fromCreate=1`); onClose(); }}
                      className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-sm font-bold text-white transition shadow shadow-amber-200"
                    >
                      Pay Now ⚡
                    </button>
                    <button
                      onClick={() => { if (appliedAppId) router.push(`/student/applications/${appliedAppId}`); onClose(); }}
                      className="flex-1 rounded-xl border-2 border-amber-200 bg-white hover:bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 transition"
                    >
                      Pay Later
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-sm text-emerald-700">
                  <BadgeCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  No application fee — totally free to apply for this one.
                </div>
              )}
            </div>

          ) : step === 0 ? (
            /* ── STEP 1: START DATE ──────────────────────── */
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-slate-900">When do you want to start? 📅</p>
                <p className="text-sm text-slate-500 mt-0.5">Lock in your intake date to get the ball rolling.</p>
              </div>

              {/* Course snapshot card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5">
                {[
                  { label: "Program", value: data.course.name },
                  { label: "School", value: data.course.university.name },
                  { label: "Applying as", value: data.studentName },
                  ...(selectedIntake ? [{ label: "Intake", value: selectedIntake }] : []),
                  ...(selectedIntakeInfo?.deadline ? [{ label: "Deadline", value: selectedIntakeInfo.deadline }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-slate-400 font-medium shrink-0">{label}</span>
                    <span className="text-slate-800 font-semibold text-right">{value}</span>
                  </div>
                ))}
              </div>

              {intakes.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Choose your start date</label>
                  <div className="space-y-2">
                    {intakes.map((intake) => (
                      <button
                        key={intake.date}
                        onClick={() => setSelectedIntake(intake.date)}
                        className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                          selectedIntake === intake.date
                            ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <CalendarDays className={`h-4 w-4 ${selectedIntake === intake.date ? "text-indigo-500" : "text-slate-400"}`} />
                          {intake.date}
                          {intake.status && (
                            <span className="rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-semibold">{intake.status}</span>
                          )}
                        </span>
                        {selectedIntake === intake.date && <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Intakes TBC</p>
                  <p className="text-xs text-slate-400 mt-1">No dates listed yet — your counsellor will sort this with the uni.</p>
                </div>
              )}
            </div>

          ) : step === 1 ? (
            /* ── STEP 2: ELIGIBILITY ─────────────────────── */
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-slate-900">How do you stack up? 🎯</p>
                <p className="text-sm text-slate-500 mt-0.5">Here&apos;s how your profile matches the entry requirements.</p>
              </div>

              {data.eligibility.matchedRequirements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Nailed it ✓</p>
                  {data.eligibility.matchedRequirements.map((r) => (
                    <div key={r} className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5">
                      <BadgeCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-emerald-800 font-medium">{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {data.eligibility.missingRequirements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Needs attention</p>
                  {data.eligibility.missingRequirements.map((r) => (
                    <div key={r} className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
                      <CircleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-amber-800 font-medium">{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {data.eligibility.matchedRequirements.length === 0 && data.eligibility.missingRequirements.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Profile incomplete</p>
                  <p className="text-xs text-slate-400 mt-1">Fill out your academic profile to see your eligibility score.</p>
                </div>
              )}

              <div className={`rounded-2xl px-4 py-3.5 text-sm font-semibold flex items-center gap-2.5 ${
                data.eligibility.eligible
                  ? "bg-emerald-500 text-white shadow shadow-emerald-200"
                  : data.eligibility.partiallyEligible
                  ? "bg-amber-500 text-white shadow shadow-amber-200"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {data.eligibility.eligible
                  ? <CheckCircle2 className="h-5 w-5 shrink-0" />
                  : <AlertTriangle className="h-5 w-5 shrink-0" />
                }
                {data.eligibility.eligible
                  ? "Looking good! You meet the requirements 💪"
                  : data.eligibility.partiallyEligible
                  ? "Partial match — you can still apply, your counsellor will guide you."
                  : data.eligibility.message || "You can still apply — counsellors review every case."}
              </div>
            </div>

          ) : step === 2 ? (
            /* ── STEP 3: ALTERNATIVES ────────────────────── */
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-slate-900">Keep your options open 🔄</p>
                <p className="text-sm text-slate-500 mt-0.5">Similar programs worth having on your radar.</p>
              </div>

              {data.similarPrograms.length > 0 ? (
                <div className="space-y-2">
                  {data.similarPrograms.slice(0, 4).map((p, i) => (
                    <div key={p.id} className="rounded-2xl border border-slate-100 bg-white p-4 flex items-center justify-between gap-3 hover:border-indigo-100 hover:bg-indigo-50/30 transition">
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          i === 0 ? "bg-violet-100 text-violet-700"
                          : i === 1 ? "bg-blue-100 text-blue-700"
                          : i === 2 ? "bg-teal-100 text-teal-700"
                          : "bg-slate-100 text-slate-600"
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{p.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{p.university.name} · {p.university.country}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 text-sm font-bold rounded-lg px-2.5 py-1 ${
                        !p.tuitionFee ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                      }`}>
                        {p.tuitionFee ? money(p.tuitionFee, p.currency) : "Free"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No alternatives found right now</p>
                  <p className="text-xs text-slate-400 mt-1">Explore more programs from the course search page.</p>
                </div>
              )}
              <p className="text-xs text-slate-400 text-center">You can apply to multiple programs at once from Course Search.</p>
            </div>

          ) : (
            /* ── STEP 4: JOURNEY ─────────────────────────── */
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-slate-900">Here&apos;s what happens next 🚀</p>
                <p className="text-sm text-slate-500 mt-0.5">Your full journey from application to enrolled — no surprises.</p>
              </div>

              <div className="space-y-2">
                {[
                  { emoji: "📋", label: "Application Submitted", desc: "Your counsellor reviews & verifies your documents.", color: "violet" },
                  { emoji: "🏫", label: "Sent to University",    desc: "Your counsellor submits everything to the uni.",     color: "blue" },
                  { emoji: "📩", label: "Offer Received",        desc: "Conditional or unconditional — uni comes back to you.", color: "indigo" },
                  { emoji: "💰", label: "Finance Sorted",        desc: "Pay your deposit & sort your financial docs.",       color: "teal" },
                  { emoji: "🛂", label: "CAS & Visa",            desc: "Get your CAS letter and apply for your visa.",        color: "cyan" },
                  { emoji: "🎓", label: "Enrolled!",             desc: "You're officially in. Go show up and crush it.",      color: "emerald" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-base shadow-sm">
                        {item.emoji}
                      </div>
                      {i < 5 && <div className="w-px h-3 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pt-1.5">
                      <p className="text-sm font-bold text-slate-900 leading-tight">{item.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fee summary card */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Cost Summary</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Tuition fee</span>
                  <span className="font-bold text-slate-900">{money(data.course.tuitionFee, data.course.currency)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Application fee</span>
                  <span className={`font-bold ${data.course.applicationFee ? "text-amber-600" : "text-emerald-600"}`}>
                    {data.course.applicationFee ? money(data.course.applicationFee, data.course.currency) : "Free ✓"}
                  </span>
                </div>
                {selectedIntake && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Your intake</span>
                    <span className="font-bold text-slate-900">{selectedIntake}</span>
                  </div>
                )}
              </div>

              {data.course.applicationFee != null && data.course.applicationFee > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-amber-800">
                    Heads up — <strong>{money(data.course.applicationFee, data.course.currency)}</strong> application fee applies. You&apos;ll be able to pay after you submit.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!applied ? (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              {step === 0 ? "Cancel" : "Back"}
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 w-6 rounded-full transition-all ${i <= step ? "bg-indigo-500" : "bg-slate-200"}`} />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 px-5 py-2.5 text-sm font-bold text-white transition shadow shadow-indigo-200"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void handleApply()}
                disabled={applying}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 px-6 py-2.5 text-sm font-bold text-white transition shadow shadow-indigo-200 disabled:opacity-60"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {applying ? "Submitting…" : "Let's Go!"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <p className="text-sm text-slate-500">Application created ✓</p>
            <button
              onClick={() => { if (appliedAppId) router.push(`/student/applications/${appliedAppId}`); onClose(); }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 px-5 py-2.5 text-sm font-bold text-white transition shadow shadow-indigo-200"
            >
              View My Application <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
