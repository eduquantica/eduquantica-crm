"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Heart, Loader2, X } from "lucide-react";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import EligibilityStatusBadge from "@/components/shared/EligibilityStatusBadge";
import { COUNTRY_QUALIFICATION_LABELS } from "@/lib/country-qualification";
import CourseViewTracker from "./CourseViewTracker";

type EligibilityStatus = {
  eligible: boolean;
  partiallyEligible: boolean;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
  matchedRequirements: string[];
  missingRequirements: string[];
  message: string;
};

type DetailResponse = {
  data: {
    course: {
      id: string;
      name: string;
      level: string;
      fieldOfStudy: string | null;
      duration: string | null;
      studyMode: string;
      tuitionFee: number | null;
      applicationFee: number | null;
      currency: string;
      description: string | null;
      curriculum: string | null;
      intakeDatesWithDeadlines: Array<{ date?: string; deadline?: string }> | null;
      totalEnrolledStudents: number;
      completionRate: number | null;
      activeScholarships: number;
      university: { id: string; name: string; country: string; city: string | null; website: string | null; currency: string };
    };
    student: {
      id: string;
      nationality: string | null;
      academicProfileComplete: boolean;
    };
    eligibility: {
      eligible: boolean;
      partiallyEligible: boolean;
      overridden: boolean;
      overriddenBy?: string;
      overriddenAt?: string;
      matchedRequirements: string[];
      missingRequirements: string[];
      message: string;
      matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
      matchScore: number;
    };
    isWishlisted: boolean;
    activeApplication: { id: string; status: string } | null;
    similarPrograms: Array<{
      id: string;
      name: string;
      level: string;
      fieldOfStudy: string | null;
      tuitionFee: number | null;
      currency: string;
      university: { name: string; country: string };
    }>;
  };
};

type ScholarshipResponse = {
  data: {
    scholarships: Array<{
      id: string;
      name: string;
      amount: number;
      currency: string;
      amountType: "FIXED" | "PERCENTAGE";
      percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
      isPartial: boolean;
      deadline: string | null;
      intakePeriod: string | null;
      eligibilityCriteria: string;
      applicationProcess: string | null;
      externalUrl: string | null;
    }>;
  };
};

type EntryRequirementsResponse = {
  data?: {
    resolvedRequirement: {
      qualificationType: keyof typeof COUNTRY_QUALIFICATION_LABELS;
      minGradeDescription: string;
      requiredSubjects: Array<{
        id: string;
        subjectName: string;
        minimumGrade: string;
        isMandatory: boolean;
      }>;
    } | null;
    generalRequirement: {
      overallDescription: string | null;
      englishReqIelts: string | null;
      englishReqPte: string | null;
      englishReqToefl: string | null;
    } | null;
  };
};

const LIVING_COST_ESTIMATES: Record<string, number> = {
  UK: 12000,
  USA: 15000,
  CANADA: 14000,
  AUSTRALIA: 13000,
  IRELAND: 11000,
};

function levelLabel(level: string) {
  return level.replaceAll("_", " ");
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return "No deadline";
  return new Date(deadline).toLocaleDateString("en-GB");
}

export default function StudentCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DetailResponse["data"] | null>(null);
  const [scholarships, setScholarships] = useState<ScholarshipResponse["data"]["scholarships"]>([]);
  const [entryRequirements, setEntryRequirements] = useState<EntryRequirementsResponse["data"] | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "entry" | "scholarships" | "similar">("overview");
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [applying, setApplying] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const detailRes = await fetch(`/api/student/courses/${courseId}`, { cache: "no-store" });
      const detailJson = await detailRes.json() as DetailResponse | { error?: string };
      if (!detailRes.ok || !detailJson || !("data" in detailJson)) {
        throw new Error("error" in detailJson ? detailJson.error || "Failed to load course details" : "Failed to load course details");
      }

      const nationality = detailJson.data.student.nationality || "";

      const [scholarshipsRes, entryRequirementsRes] = await Promise.all([
        fetch(`/api/student/courses/${courseId}/scholarships`, { cache: "no-store" }),
        fetch(`/api/courses/${courseId}/country-entry-requirements?studentNationality=${encodeURIComponent(nationality)}`, { cache: "no-store" }),
      ]);

      const scholarshipsJson = await scholarshipsRes.json() as ScholarshipResponse | { error?: string };
      if (!scholarshipsRes.ok || !("data" in scholarshipsJson)) {
        throw new Error("error" in scholarshipsJson ? scholarshipsJson.error || "Failed to load scholarships" : "Failed to load scholarships");
      }

      const entryRequirementsJson = await entryRequirementsRes.json() as EntryRequirementsResponse;

      setPayload(detailJson.data);
      setIsWishlisted(detailJson.data.isWishlisted);
      setScholarships(scholarshipsJson.data.scholarships);
      setEntryRequirements(entryRequirementsJson.data ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course details");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleWishlist() {
    if (!payload) return;

    try {
      setSavingWishlist(true);
      const res = await fetch("/api/student/wishlist", {
        method: isWishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: payload.course.id }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update wishlist");
      setIsWishlisted((prev) => !prev);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update wishlist");
    } finally {
      setSavingWishlist(false);
    }
  }

  async function applyNow() {
    if (!payload) return;
    try {
      setApplying(true);
      setActionMessage(null);
      const res = await fetch("/api/student/applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: payload.course.id }),
      });
      const json = await res.json() as {
        error?: string;
        existingApplicationId?: string;
        data?: {
          application?: { id: string };
          fee?: { feeRequired?: boolean };
        };
      };

      if (res.status === 409) {
        setActionMessage(json.error || "You already have an active application for this course.");
        if (json.existingApplicationId) {
          router.push(`/student/applications/${json.existingApplicationId}`);
        }
        return;
      }

      if (!res.ok || !json.data?.application?.id) {
        throw new Error(json.error || "Failed to create application");
      }

      if (json.data.fee?.feeRequired) {
        router.push(`/student/applications/${json.data.application.id}/fee?fromCreate=1`);
      } else {
        router.push(`/student/applications/${json.data.application.id}`);
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  const livingEstimate = useMemo(() => {
    const country = payload?.course.university.country.toUpperCase().trim() || "";
    return LIVING_COST_ESTIMATES[country] || 10000;
  }, [payload?.course.university.country]);

  const estimatedTotal = (payload?.course.tuitionFee || 0) + (payload?.course.applicationFee || 0) + livingEstimate;

  if (loading) return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading course details...</div>;
  if (error || !payload) return <div className="p-6 text-sm text-red-600 dark:text-rose-300">{error || "Failed to load course details"}</div>;

  return (
    <main className="student-dashboard-bg mx-auto w-full max-w-7xl space-y-6 rounded-3xl px-4 py-6 pb-24 sm:px-6 lg:pb-6">
      <CourseViewTracker courseId={courseId} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{payload.course.name}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{payload.course.university.name} • {payload.course.university.country}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {levelLabel(payload.course.level)}
            {payload.course.fieldOfStudy ? ` • ${payload.course.fieldOfStudy}` : ""}
            {payload.course.duration ? ` • ${payload.course.duration}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleWishlist}
            disabled={savingWishlist}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${isWishlisted ? "border-rose-300 bg-rose-50/70 text-rose-700 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300" : "border-white/50 bg-white/70 text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"}`}
          >
            {savingWishlist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`} />}
            {isWishlisted ? "Wishlisted" : "Save"}
          </button>
          <Link href="/student/courses" className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900">
            Back
          </Link>
        </div>
      </div>

      {actionMessage && (
        <section className="rounded-xl border border-blue-200/80 bg-blue-50/90 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">
          {actionMessage}
        </section>
      )}

      {!payload.student.academicProfileComplete && (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/25 dark:text-amber-200">
          Complete your academic profile to unlock personalized eligibility insights.
          <Link href="/student/profile" className="ml-2 font-semibold underline">Complete profile</Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <section className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "overview", label: "Overview" },
                { id: "entry", label: "Entry Requirements" },
                { id: "scholarships", label: "Scholarships" },
                { id: "similar", label: "Similar Programs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "overview" | "entry" | "scholarships" | "similar")}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${activeTab === tab.id ? "bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] text-white shadow-sm dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900" : "bg-white/60 text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" && (
            <section className="glass-card space-y-4 rounded-xl p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Course Overview</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{payload.course.description || "Overview not available yet."}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Curriculum</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{payload.course.curriculum || "Curriculum details not available yet."}</p>
              </div>
            </section>
          )}

          {activeTab === "entry" && (
            <section className="glass-card space-y-4 rounded-xl p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Entry Requirements</h2>
              {payload.student.academicProfileComplete ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <EligibilityStatusBadge status={payload.eligibility as EligibilityStatus} isStaff={false} />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Match score: {Math.round(payload.eligibility.matchScore)}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">Complete your academic profile to view personalized eligibility.</p>
              )}

              {entryRequirements?.resolvedRequirement && (
                <div className="rounded-lg border border-white/40 bg-white/50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Qualification:</span> {COUNTRY_QUALIFICATION_LABELS[entryRequirements.resolvedRequirement.qualificationType]}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Minimum grade:</span> {entryRequirements.resolvedRequirement.minGradeDescription}</p>
                  {entryRequirements.resolvedRequirement.requiredSubjects.length > 0 && (
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Required subjects:</span>{" "}
                      {entryRequirements.resolvedRequirement.requiredSubjects
                        .map((subject) => `${subject.subjectName} (${subject.minimumGrade}${subject.isMandatory ? ", mandatory" : ""})`)
                        .join(" • ")}
                    </p>
                  )}
                </div>
              )}

              {entryRequirements?.generalRequirement && (
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {entryRequirements.generalRequirement.overallDescription && (
                    <p>{entryRequirements.generalRequirement.overallDescription}</p>
                  )}
                  <p>
                    English thresholds: IELTS {entryRequirements.generalRequirement.englishReqIelts || "N/A"} •
                    PTE {entryRequirements.generalRequirement.englishReqPte || "N/A"} •
                    TOEFL {entryRequirements.generalRequirement.englishReqToefl || "N/A"}
                  </p>
                </div>
              )}
            </section>
          )}

          {activeTab === "scholarships" && (
            <section className="glass-card space-y-3 rounded-xl p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Scholarships</h2>
              {scholarships.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">No active scholarships are currently listed for this course.</p>
              ) : (
                scholarships.map((scholarship) => (
                  <article key={scholarship.id} className="rounded-lg border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/30">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{scholarship.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{scholarship.isPartial ? "Partial" : "Full"} • Deadline: {deadlineLabel(scholarship.deadline)}</p>
                      </div>
                      {scholarship.amountType === "FIXED" ? (
                        <CurrencyDisplay amount={scholarship.amount} baseCurrency={scholarship.currency || payload.course.currency} studentNationality={payload.student.nationality || undefined} />
                      ) : (
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{scholarship.amount}% ({scholarship.percentageOf || "TOTAL"})</p>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{scholarship.eligibilityCriteria}</p>
                    {scholarship.applicationProcess && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{scholarship.applicationProcess}</p>
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {activeTab === "similar" && (
            <section className="glass-card space-y-3 rounded-xl p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Similar Programs</h2>
              {payload.similarPrograms.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">No similar programs found.</p>
              ) : (
                payload.similarPrograms.map((program) => (
                  <article key={program.id} className="rounded-lg border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/30">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{program.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{program.university.name} • {program.university.country}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{levelLabel(program.level)}{program.fieldOfStudy ? ` • ${program.fieldOfStudy}` : ""}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {program.tuitionFee ? (
                        <CurrencyDisplay amount={program.tuitionFee} baseCurrency={program.currency} studentNationality={payload.student.nationality || undefined} />
                      ) : (
                        <p className="text-sm text-slate-700 dark:text-slate-300">Tuition N/A</p>
                      )}
                      <Link href={`/student/courses/${program.id}`} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">View</Link>
                    </div>
                  </article>
                ))
              )}
            </section>
          )}
        </section>

        <aside className="space-y-4">
          <section className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Facts</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>Study mode: {payload.course.studyMode.replaceAll("_", " ")}</p>
              <p>Completion rate: {payload.course.completionRate ?? "N/A"}%</p>
              <p>Enrolled students: {payload.course.totalEnrolledStudents}</p>
              <p>Active scholarships: {payload.course.activeScholarships}</p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Estimated Costs</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">View tuition + application fee + estimated annual living costs.</p>
            <button onClick={() => setShowCostModal(true)} className="mt-3 w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900">
              Open Estimator
            </button>
          </section>

          <section className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">University</h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{payload.course.university.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{payload.course.university.city ? `${payload.course.university.city}, ` : ""}{payload.course.university.country}</p>
            {payload.course.university.website && (
              <a href={payload.course.university.website} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
                Visit university site
              </a>
            )}
          </section>

          {payload.activeApplication ? (
            <Link
              href={`/student/applications/${payload.activeApplication.id}`}
              className="hidden w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/80 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300 lg:inline-flex"
            >
              Already Applied — View Application
            </Link>
          ) : (
            <button
              onClick={applyNow}
              disabled={applying}
              className="hidden w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] px-4 py-2 text-sm font-semibold text-white shadow-md hover:opacity-95 dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900 disabled:opacity-60 lg:inline-flex"
            >
              {applying && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply Now
            </button>
          )}
        </aside>
      </div>

      {showCostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/30 bg-white/90 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Estimated Costs (Read-only)</h3>
              <button onClick={() => setShowCostModal(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Annual tuition</span>
                {payload.course.tuitionFee ? <CurrencyDisplay amount={payload.course.tuitionFee} baseCurrency={payload.course.currency} studentNationality={payload.student.nationality || undefined} /> : <span>N/A</span>}
              </div>
              <div className="flex items-center justify-between">
                <span>Application fee</span>
                {payload.course.applicationFee ? <CurrencyDisplay amount={payload.course.applicationFee} baseCurrency={payload.course.currency} studentNationality={payload.student.nationality || undefined} /> : <span>Free / N/A</span>}
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated living cost (12 months)</span>
                <CurrencyDisplay amount={livingEstimate} baseCurrency={payload.course.currency} studentNationality={payload.student.nationality || undefined} />
              </div>
              <div className="border-t border-white/50 pt-3 dark:border-white/10">
                <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                  <span>Estimated total first-year cost</span>
                  <CurrencyDisplay amount={estimatedTotal} baseCurrency={payload.course.currency} studentNationality={payload.student.nationality || undefined} />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Estimates are indicative only and exclude personal expenses, exchange-rate shifts, and optional charges.</p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/30 bg-white/90 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <button
            onClick={toggleWishlist}
            disabled={savingWishlist}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${isWishlisted ? "border-rose-300 bg-rose-50/80 text-rose-700 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300" : "border-white/50 bg-white/70 text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"}`}
          >
            {savingWishlist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`} />}
          </button>
          {payload.activeApplication ? (
            <Link
              href={`/student/applications/${payload.activeApplication.id}`}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/80 px-4 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              Already Applied — View Application
            </Link>
          ) : (
            <button
              onClick={applyNow}
              disabled={applying}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] px-4 text-sm font-semibold text-white dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900 disabled:opacity-60"
            >
              {applying && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply Now
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
