"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Loader2, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import EligibilityStatusBadge from "@/components/shared/EligibilityStatusBadge";

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

type CourseItem = {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  duration?: string | null;
  tuitionFee: number | null;
  currency: string;
  university: { id: string; name: string; country: string };
  matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
  matchScore: number;
  eligibility: EligibilityStatus;
  scholarshipCount: number;
};

type EligibilityResponse = {
  data: {
    academicProfileComplete: boolean;
    courses: CourseItem[];
  };
};

function formatLevel(level: string) {
  return level.replaceAll("_", " ");
}

function successChance(matchScore: number) {
  return Math.max(10, Math.min(95, Math.round(matchScore)));
}

export default function StudentCoursesEligibilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [academicComplete, setAcademicComplete] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedField, setSelectedField] = useState("all");
  const [eligibleOnly, setEligibleOnly] = useState(false);

  const [scholarshipOnly, setScholarshipOnly] = useState(false);
  const [minScholarship, setMinScholarship] = useState(0);
  const [fullScholarshipOnly, setFullScholarshipOnly] = useState(false);
  const [openForNationality, setOpenForNationality] = useState(false);
  const [deadlineNotPassed, setDeadlineNotPassed] = useState(true);
  const [tuitionLimit, setTuitionLimit] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("best_match");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [savingWishlistId, setSavingWishlistId] = useState<string | null>(null);
  const [applyingCourseId, setApplyingCourseId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("showAll", "1");
      if (scholarshipOnly) params.set("scholarshipOnly", "1");
      if (minScholarship > 0) params.set("minScholarship", String(minScholarship));
      if (fullScholarshipOnly) params.set("fullScholarshipOnly", "1");
      if (openForNationality) params.set("openForNationality", "1");
      if (deadlineNotPassed) params.set("deadlineNotPassed", "1");

      const [eligibilityRes, wishlistRes] = await Promise.all([
        fetch(`/api/student/courses/eligibility?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/student/wishlist", { cache: "no-store" }),
      ]);

      const eligibilityJson = await eligibilityRes.json() as EligibilityResponse | { error: string };
      if (!eligibilityRes.ok || !("data" in eligibilityJson)) {
        throw new Error("error" in eligibilityJson ? eligibilityJson.error : "Failed to load courses");
      }

      const wishlistJson = await wishlistRes.json() as { data?: { courseIds?: string[] }; error?: string };
      if (!wishlistRes.ok) {
        throw new Error(wishlistJson.error || "Failed to load wishlist");
      }

      setCourses(eligibilityJson.data.courses);
      setAcademicComplete(eligibilityJson.data.academicProfileComplete);
      setWishlistIds(new Set(wishlistJson.data?.courseIds || []));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [scholarshipOnly, minScholarship, fullScholarshipOnly, openForNationality, deadlineNotPassed]);

  useEffect(() => {
    void load();
  }, [load]);

  const tuitionCap = useMemo(() => {
    const tuitionValues = courses.map((course) => course.tuitionFee || 0);
    return tuitionValues.length > 0 ? Math.max(...tuitionValues) : 0;
  }, [courses]);

  async function toggleWishlist(courseId: string) {
    try {
      setSavingWishlistId(courseId);
      const wishlisted = wishlistIds.has(courseId);
      const res = await fetch("/api/student/wishlist", {
        method: wishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update wishlist");

      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (wishlisted) {
          next.delete(courseId);
        } else {
          next.add(courseId);
        }
        return next;
      });
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update wishlist");
    } finally {
      setSavingWishlistId(null);
    }
  }

  async function applyNow(courseId: string) {
    try {
      setApplyingCourseId(courseId);
      setActionMessage(null);
      const res = await fetch("/api/student/applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = await res.json() as {
        error?: string;
        data?: { application?: { id: string } };
        existingApplicationId?: string;
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

      router.push(`/student/applications/${json.data.application.id}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplyingCourseId(null);
    }
  }

  const countries = useMemo(
    () => Array.from(new Set(courses.map((course) => course.university.country))).sort((a, b) => a.localeCompare(b)),
    [courses],
  );
  const levels = useMemo(() => Array.from(new Set(courses.map((course) => course.level))), [courses]);
  const fields = useMemo(
    () => Array.from(new Set(courses.map((course) => course.fieldOfStudy).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [courses],
  );

  const filtered = useMemo(() => {
    const rows = courses.filter((course) => {
      if (academicComplete && eligibleOnly && course.matchStatus === "NO_MATCH") return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesSearch = (
          course.name.toLowerCase().includes(query)
          || (course.fieldOfStudy || "").toLowerCase().includes(query)
          || course.university.name.toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }
      if (selectedCountry !== "all" && course.university.country !== selectedCountry) return false;
      if (selectedLevel !== "all" && course.level !== selectedLevel) return false;
      if (selectedField !== "all" && (course.fieldOfStudy || "") !== selectedField) return false;
      if (tuitionLimit !== null && course.tuitionFee && course.tuitionFee > tuitionLimit) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sortBy === "tuition_low") return (a.tuitionFee || Number.MAX_SAFE_INTEGER) - (b.tuitionFee || Number.MAX_SAFE_INTEGER);
      if (sortBy === "tuition_high") return (b.tuitionFee || 0) - (a.tuitionFee || 0);
      if (sortBy === "scholarships") return b.scholarshipCount - a.scholarshipCount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return b.matchScore - a.matchScore;
    });

    return rows;
  }, [
    academicComplete,
    courses,
    eligibleOnly,
    tuitionLimit,
    search,
    selectedCountry,
    selectedField,
    selectedLevel,
    sortBy,
  ]);

  const filtersPanel = (
    <section className="glass-card rounded-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
        <button
          onClick={() => {
            setSearch("");
            setSelectedCountry("all");
            setSelectedLevel("all");
            setSelectedField("all");
            setEligibleOnly(false);
            setScholarshipOnly(false);
            setFullScholarshipOnly(false);
            setOpenForNationality(false);
            setDeadlineNotPassed(true);
            setTuitionLimit(null);
            setSortBy("best_match");
          }}
          className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          Reset
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Search</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Course, field, or university"
            className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 backdrop-blur-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Country</label>
          <select
            value={selectedCountry}
            onChange={(event) => setSelectedCountry(event.target.value)}
            className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 backdrop-blur-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20"
          >
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Level</label>
          <select
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value)}
            className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 backdrop-blur-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20"
          >
            <option value="all">All levels</option>
            {levels.map((level) => (
              <option key={level} value={level}>{formatLevel(level)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Field of Study</label>
          <select
            value={selectedField}
            onChange={(event) => setSelectedField(event.target.value)}
            className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 backdrop-blur-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20"
          >
            <option value="all">All fields</option>
            {fields.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Max tuition: {tuitionLimit !== null ? tuitionLimit.toLocaleString() : "Any"}
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(tuitionCap, 10000)}
            step={500}
            value={tuitionLimit ?? Math.max(tuitionCap, 10000)}
            onChange={(event) => setTuitionLimit(Number(event.target.value))}
            className="w-full"
          />
        </div>

        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {academicComplete && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={eligibleOnly} onChange={(event) => setEligibleOnly(event.target.checked)} className="h-4 w-4" />
              Eligible only
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scholarshipOnly} onChange={(event) => setScholarshipOnly(event.target.checked)} className="h-4 w-4" />
            Scholarships only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fullScholarshipOnly} onChange={(event) => setFullScholarshipOnly(event.target.checked)} className="h-4 w-4" />
            Full scholarships
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={openForNationality} onChange={(event) => setOpenForNationality(event.target.checked)} className="h-4 w-4" />
            Open for my nationality
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={deadlineNotPassed} onChange={(event) => setDeadlineNotPassed(event.target.checked)} className="h-4 w-4" />
            Deadline not passed
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Minimum scholarship amount</label>
          <input
            type="number"
            min={0}
            step={100}
            value={minScholarship}
            onChange={(event) => setMinScholarship(Number(event.target.value) || 0)}
            className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 backdrop-blur-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20"
          />
        </div>
      </div>
    </section>
  );

  return (
    <main className="student-dashboard-bg mx-auto w-full max-w-7xl space-y-6 rounded-3xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Find Your Best-Fit Courses</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Compare programs by eligibility, tuition, and scholarship opportunities.</p>
        </div>
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      {!academicComplete && (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/25 dark:text-amber-200">
          Eligibility insights are hidden until your academic profile is complete.
          <Link href="/student/profile" className="ml-2 font-semibold underline">Complete profile now</Link>
        </section>
      )}

      {actionMessage && (
        <section className="rounded-xl border border-blue-200/80 bg-blue-50/90 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">
          {actionMessage}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
        <div className="hidden lg:block">{filtersPanel}</div>

        <section className="space-y-4">
          <div className="glass-card flex items-center justify-between rounded-xl p-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">{filtered.length} courses found</p>
            <div className="inline-flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">Sort</label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-sm text-slate-800 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              >
                <option value="best_match">Best match</option>
                <option value="scholarships">Most scholarships</option>
                <option value="tuition_low">Tuition: low to high</option>
                <option value="tuition_high">Tuition: high to low</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="glass-card rounded-xl p-6 text-sm text-slate-600 dark:text-slate-300">Loading courses...</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/90 p-6 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((course) => {
                const isWishlisted = wishlistIds.has(course.id);
                return (
                  <article key={course.id} className="glass-card rounded-xl p-4 transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{course.name}</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{course.university.name} • {course.university.country}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatLevel(course.level)}{course.fieldOfStudy ? ` • ${course.fieldOfStudy}` : ""}</p>
                      </div>
                      <button
                        onClick={() => toggleWishlist(course.id)}
                        disabled={savingWishlistId === course.id}
                        className={`rounded-full p-2 ${isWishlisted ? "text-rose-600 dark:text-rose-400" : "text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"}`}
                        aria-label="Toggle wishlist"
                      >
                        <Heart className={`h-5 w-5 ${isWishlisted ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-white/40 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-900/40">
                        <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Tuition</p>
                        {course.tuitionFee ? (
                          <CurrencyDisplay amount={course.tuitionFee} baseCurrency={course.currency} />
                        ) : (
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">N/A</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-white/40 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-900/40">
                        <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Scholarships</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{course.scholarshipCount} available</p>
                      </div>
                      <div className="rounded-lg border border-white/40 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-900/40">
                        <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Success Chance</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {academicComplete ? `${successChance(course.matchScore)}%` : "Complete profile to unlock"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {academicComplete ? (
                        <EligibilityStatusBadge status={course.eligibility} isStaff={false} />
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                          Eligibility locked
                        </span>
                      )}
                      {course.scholarshipCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Scholarship Available
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/student/courses/${course.id}`}
                        className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => applyNow(course.id)}
                        disabled={applyingCourseId === course.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900 disabled:opacity-60"
                      >
                        {applyingCourseId === course.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Apply Now
                      </button>
                    </div>
                  </article>
                );
              })}

              {filtered.length === 0 && (
                <div className="glass-card rounded-xl p-6 text-sm text-slate-600 dark:text-slate-300">
                  No courses found for the selected filters.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto border-l border-white/20 bg-white/90 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
              <button onClick={() => setMobileFiltersOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            {filtersPanel}
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] px-4 py-2 text-sm font-semibold text-white dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
