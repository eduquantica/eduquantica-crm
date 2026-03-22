"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Scale, Sparkles } from "lucide-react";
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
  university: {
    name: string;
    country: string;
  };
};

type WishlistResponse = {
  data: {
    studentNationality?: string | null;
    courses: WishlistCourse[];
  };
};

function formatLevel(level: string) {
  return level.replaceAll("_", " ");
}

function nextIntakeLabel(intake: { date?: string; deadline?: string } | null) {
  if (!intake) return "Intake not listed";
  if (intake.date) return intake.date;
  if (intake.deadline) return `By ${new Date(intake.deadline).toLocaleDateString("en-GB")}`;
  return "Intake not listed";
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
        if (!res.ok || !("data" in json)) {
          throw new Error("error" in json ? json.error || "Failed to load wishlist" : "Failed to load wishlist");
        }

        if (cancelled) return;

        setCourses(json.data.courses || []);
        setStudentNationality(json.data.studentNationality || null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load wishlist");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCount = selectedIds.size;
  const selectedAtLimit = selectedCount >= 5;

  async function removeFromWishlist(courseId: string) {
    try {
      setRemovingId(courseId);
      const res = await fetch("/api/student/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to remove from wishlist");

      setCourses((prev) => prev.filter((course) => course.id !== courseId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      toast.success("Removed from wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove from wishlist");
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
        data?: {
          application?: { id: string };
          applicationId?: string;
          fee?: { feeRequired?: boolean };
        };
      };

      if (res.status === 409) {
        toast.error(json.error || "You already have an active application for this course.");
        const existingId = json.existingApplicationId || json.data?.application?.id || json.data?.applicationId;
        if (existingId) router.push(`/student/applications/${existingId}`);
        return;
      }

      const applicationId = json.data?.application?.id || json.data?.applicationId;
      if (!res.ok || !applicationId) {
        throw new Error(json.error || "Failed to create application");
      }

      toast.success(`Application submitted for ${course.name} at ${course.university.name}.`);
      setTimeout(() => {
        if (json.data?.fee?.feeRequired) {
          router.push(`/student/applications/${applicationId}/fee?fromCreate=1`);
        } else {
          router.push(`/student/applications/${applicationId}`);
        }
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
      if (checked) {
        if (next.size >= 5 && !next.has(courseId)) return next;
        next.add(courseId);
      } else {
        next.delete(courseId);
      }
      return next;
    });
  }

  const compareHref = useMemo(() => {
    const ids = Array.from(selectedIds);
    return `/student/wishlist/compare?ids=${encodeURIComponent(ids.join(","))}`;
  }, [selectedIds]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading wishlist...</div>
      </main>
    );
  }

  if (courses.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
            <Heart className="h-10 w-10 text-rose-400" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">You have not saved any courses yet.</h1>
          <p className="mt-2 text-sm text-slate-600">Start exploring and heart the courses you like.</p>
          <Link
            href="/student/courses"
            className="mt-6 inline-flex h-11 items-center rounded-lg bg-[#1E3A5F] px-5 text-sm font-semibold text-white hover:opacity-95"
          >
            Browse Courses
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Wishlist</h1>
          <p className="mt-1 text-sm text-slate-600">Compare your saved courses and apply when ready.</p>
        </div>
        <Link href="/student/courses" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Browse Courses
        </Link>
      </header>

      {selectedAtLimit && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Maximum 5 courses can be compared.
        </section>
      )}

      <section className="space-y-3">
        {courses.map((course) => {
          const isSelected = selectedIds.has(course.id);
          const disableCheckbox = !isSelected && selectedAtLimit;

          return (
            <article key={course.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{course.name}</h2>
                  <p className="text-sm text-slate-600">{course.university.name} • {course.university.country}</p>
                  <p className="text-xs text-slate-500">
                    {formatLevel(course.level)}
                    {course.fieldOfStudy ? ` • ${course.fieldOfStudy}` : ""}
                    {course.duration ? ` • ${course.duration}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => void removeFromWishlist(course.id)}
                  disabled={removingId === course.id}
                  className="rounded-full p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                  aria-label="Remove from wishlist"
                  title="Remove from wishlist"
                >
                  {removingId === course.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5 fill-current" />}
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-500">Tuition</p>
                  {course.tuitionFee ? (
                    <CurrencyDisplay amount={course.tuitionFee} baseCurrency={course.currency} studentNationality={studentNationality || undefined} />
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">N/A</p>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-500">Application Fee</p>
                  {course.applicationFee ? (
                    <p className="text-sm font-semibold text-slate-900">{course.currency} {course.applicationFee.toLocaleString()}</p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">Free / N/A</p>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-500">Next Intake</p>
                  <p className="text-sm font-semibold text-slate-900">{nextIntakeLabel(course.nextIntake)}</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] uppercase text-slate-500">Success Chance</p>
                  <p className="text-sm font-semibold text-slate-900">{course.successChance}%</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <EligibilityStatusBadge status={course.eligibility} isStaff={false} />
                {course.scholarshipCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    Scholarship Available
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className={`inline-flex items-center gap-2 text-sm ${disableCheckbox ? "text-slate-400" : "text-slate-700"}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disableCheckbox}
                    onChange={(event) => toggleCourseSelection(course.id, event.target.checked)}
                    className="h-4 w-4"
                  />
                  Select for comparison
                </label>

                <button
                  onClick={() => void applyNow(course)}
                  disabled={applyingId === course.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {applyingId === course.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Apply Now
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {selectedCount >= 2 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{selectedCount} selected for comparison</p>
            <Link
              href={compareHref}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              <Scale className="h-4 w-4" />
              Compare ({selectedCount}) Courses
            </Link>
          </div>
        </div>
      )}

      {selectedCount < 2 && (
        <div className="fixed bottom-4 right-4 hidden rounded-full bg-white/90 p-2 text-slate-500 shadow-sm lg:block">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
    </main>
  );
}
