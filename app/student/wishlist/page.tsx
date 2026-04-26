"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
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
  matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
  matchScore: number;
};

type WishlistCourse = {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  duration: string | null;
  tuitionFee: number | null;
  applicationFee: number | null;
  currency: string;
  nextIntake: { date?: string; deadline?: string } | null;
  scholarshipCount: number;
  eligibility: EligibilityStatus;
  successChance: number;
  university: { name: string; country: string };
};

type WishlistResponse = {
  data: { studentNationality?: string | null; courses: WishlistCourse[] };
};

function formatLevel(level: string) { return level.replaceAll("_", " "); }

function nextIntakeLabel(intake: { date?: string; deadline?: string } | null) {
  if (!intake) return "Not listed";
  if (intake.date) return intake.date;
  if (intake.deadline) return `By ${new Date(intake.deadline).toLocaleDateString("en-GB")}`;
  return "Not listed";
}

function SuccessBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#F5A623" : "#ef4444";
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function StudentWishlistPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<WishlistCourse[]>([]);
  const [studentNationality, setStudentNationality] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/student/wishlist?details=1", { cache: "no-store" });
        const json = (await res.json()) as WishlistResponse | { error?: string };
        if (!res.ok || !("data" in json)) throw new Error("error" in json ? json.error || "Failed to load" : "Failed to load");
        if (cancelled) return;
        setCourses(json.data.courses || []);
        setStudentNationality(json.data.studentNationality || null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load wishlist");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function removeFromWishlist(courseId: string) {
    try {
      setRemovingId(courseId);
      const res = await fetch("/api/student/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to remove");
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(courseId); return next; });
      toast.success("Removed from wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  }

  async function applyNow(course: WishlistCourse) {
    try {
      setApplyingId(course.id);
      const res = await fetch("/api/student/applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      const json = (await res.json()) as {
        error?: string;
        existingApplicationId?: string;
        data?: { application?: { id: string }; applicationId?: string; fee?: { feeRequired?: boolean } };
      };
      if (res.status === 409) {
        toast.error(json.error || "You already have an active application for this course.");
        const existingId = json.existingApplicationId || json.data?.application?.id || json.data?.applicationId;
        if (existingId) router.push(`/student/applications/${existingId}`);
        return;
      }
      const applicationId = json.data?.application?.id || json.data?.applicationId;
      if (!res.ok || !applicationId) throw new Error(json.error || "Failed to create application");
      toast.success(`Applied for ${course.name}!`);
      setTimeout(() => {
        router.push(json.data?.fee?.feeRequired ? `/student/applications/${applicationId}/fee?fromCreate=1` : `/student/applications/${applicationId}`);
      }, 250);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply");
    } finally {
      setApplyingId(null);
    }
  }

  function toggleCourseSelection(courseId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) { if (next.size >= 5 && !next.has(courseId)) return next; next.add(courseId); }
      else next.delete(courseId);
      return next;
    });
  }

  const compareHref = useMemo(() => {
    const ids = Array.from(selectedIds);
    return `/student/wishlist/compare?ids=${encodeURIComponent(ids.join(","))}`;
  }, [selectedIds]);

  const selectedCount = selectedIds.size;
  const selectedAtLimit = selectedCount >= 5;

  if (loading) {
    return (
      <main className="w-full px-5 py-6 sm:px-7">
        <div className="glass-card p-6 text-sm text-slate-500">Loading your wishlist...</div>
      </main>
    );
  }

  if (courses.length === 0) {
    return (
      <main className="w-full px-5 py-6 sm:px-7">
        <div className="glass-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl" style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}>
            ❤️
          </div>
          <h1 className="text-xl font-black text-[#1B2A4A]">Your wishlist is empty</h1>
          <p className="mt-2 text-sm text-slate-500">Save courses you love and apply when you&apos;re ready.</p>
          <Link
            href="/student/courses"
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}
          >
            🔍 Browse Courses
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-5 py-6 sm:px-7 space-y-5 pb-24">
      {/* Header */}
      <section
        className="relative overflow-hidden rounded-2xl px-6 py-5 md:px-8"
        style={{ background: "linear-gradient(135deg, #1B2A4A 0%, #162643 55%, #0d1f3c 100%)" }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #F5A623, transparent)" }} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-white">❤️ My Wishlist</h1>
            <p className="text-sm text-white/55 mt-0.5">
              {courses.length} saved course{courses.length !== 1 ? "s" : ""} — compare and apply when you&apos;re ready.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount >= 2 && (
              <Link
                href={compareHref}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-[#1B2A4A]"
                style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
              >
                <Scale className="h-3.5 w-3.5" /> Compare ({selectedCount})
              </Link>
            )}
            <Link
              href="/student/courses"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/18 transition-all"
            >
              🔍 Browse More
            </Link>
          </div>
        </div>
      </section>

      {selectedAtLimit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ⚠️ Maximum 5 courses can be compared at once.
        </div>
      )}

      {/* Course cards */}
      <section className="space-y-3">
        {courses.map((course) => {
          const isSelected = selectedIds.has(course.id);
          const disableCheckbox = !isSelected && selectedAtLimit;

          return (
            <article
              key={course.id}
              className="glass-card overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #1B2A4A, #F5A623)" }} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-[#1B2A4A]">{course.name}</h2>
                    <p className="text-sm text-slate-500">{course.university.name} · {course.university.country}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatLevel(course.level)}
                      {course.fieldOfStudy ? ` · ${course.fieldOfStudy}` : ""}
                      {course.duration ? ` · ${course.duration}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => void removeFromWishlist(course.id)}
                    disabled={removingId === course.id}
                    className="shrink-0 rounded-xl p-2 text-rose-500 transition hover:bg-rose-50 disabled:opacity-60"
                    aria-label="Remove from wishlist"
                  >
                    {removingId === course.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5 fill-current" />}
                  </button>
                </div>

                {/* Stats grid */}
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl p-3" style={{ background: "rgba(27,42,74,0.04)", border: "1px solid rgba(27,42,74,0.08)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tuition</p>
                    <div className="mt-1 text-sm font-black text-[#1B2A4A]">
                      {course.tuitionFee ? (
                        <CurrencyDisplay amount={course.tuitionFee} baseCurrency={course.currency} studentNationality={studentNationality || undefined} />
                      ) : "N/A"}
                    </div>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: "rgba(27,42,74,0.04)", border: "1px solid rgba(27,42,74,0.08)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">App Fee</p>
                    <p className="mt-1 text-sm font-black text-[#1B2A4A]">
                      {course.applicationFee ? `${course.currency} ${course.applicationFee.toLocaleString()}` : "Free / N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: "rgba(27,42,74,0.04)", border: "1px solid rgba(27,42,74,0.08)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Next Intake</p>
                    <p className="mt-1 text-sm font-black text-[#1B2A4A]">{nextIntakeLabel(course.nextIntake)}</p>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: "rgba(27,42,74,0.04)", border: "1px solid rgba(27,42,74,0.08)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Success</p>
                    <p className="mt-1 text-sm font-black text-[#1B2A4A]">{course.successChance}%</p>
                    <SuccessBar pct={course.successChance} />
                  </div>
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <EligibilityStatusBadge status={course.eligibility} isStaff={false} />
                  {course.scholarshipCount > 0 && (
                    <span className="rounded-full px-3 py-1 text-xs font-bold text-[#1B2A4A]" style={{ background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)" }}>
                      🏆 {course.scholarshipCount} Scholarship{course.scholarshipCount > 1 ? "s" : ""} Available
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <label className={`inline-flex items-center gap-2 text-sm font-medium cursor-pointer ${disableCheckbox ? "text-slate-300" : "text-slate-500"}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disableCheckbox}
                      onChange={(e) => toggleCourseSelection(course.id, e.target.checked)}
                      className="h-4 w-4 rounded accent-[#1B2A4A]"
                    />
                    Select for comparison
                  </label>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/student/courses/${course.id}`}
                      className="rounded-xl border px-4 py-2 text-xs font-bold text-[#1B2A4A] hover:bg-slate-50 transition-all"
                      style={{ borderColor: "rgba(27,42,74,0.2)" }}
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => void applyNow(course)}
                      disabled={applyingId === course.id}
                      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-[#1B2A4A] disabled:opacity-60 transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
                    >
                      {applyingId === course.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Apply Now →
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Sticky compare bar */}
      {selectedCount >= 2 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t px-5 py-3"
          style={{ borderColor: "rgba(27,42,74,0.1)", background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#1B2A4A]">{selectedCount} courses selected for comparison</p>
            <Link
              href={compareHref}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}
            >
              <Scale className="h-4 w-4" /> Compare Now
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
