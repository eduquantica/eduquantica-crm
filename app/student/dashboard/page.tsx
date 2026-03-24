import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  CircleDashed,
  FileText,
  GraduationCap,
  MessageCircle,
  Mic,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateProfileCompletionDetails } from "@/lib/profile-completion";
import TimeGreeting from "./TimeGreeting";

type AppStatus =
  | "DRAFT"
  | "DOCUMENTS_PENDING"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CONDITIONAL_OFFER"
  | "UNCONDITIONAL_OFFER"
  | "CAS_ISSUED"
  | "VISA_APPLIED"
  | "VISA_APPROVED"
  | "VISA_REJECTED"
  | "ENROLLED"
  | "WITHDRAWN";

type StatusMeta = { label: string; badge: string; nextStep: string; icon: typeof CircleDashed | null; color: string };

const STATUS_UI: Record<AppStatus | "UNKNOWN", StatusMeta> = {
  DRAFT: { label: "Draft", badge: "bg-slate-100 text-slate-700", nextStep: "Complete your application details", icon: CircleDashed, color: "gray" },
  DOCUMENTS_PENDING: { label: "Documents Pending", badge: "bg-amber-100 text-amber-700", nextStep: "Upload required documents", icon: FileText, color: "amber" },
  SUBMITTED: { label: "Submitted", badge: "bg-blue-100 text-blue-700", nextStep: "Await university review", icon: Send, color: "blue" },
  UNDER_REVIEW: { label: "Under Review", badge: "bg-blue-100 text-blue-700", nextStep: "Await university decision", icon: Send, color: "blue" },
  CONDITIONAL_OFFER: { label: "Conditional Offer", badge: "bg-yellow-100 text-yellow-700", nextStep: "Complete your offer conditions", icon: GraduationCap, color: "yellow" },
  UNCONDITIONAL_OFFER: { label: "Unconditional Offer", badge: "bg-emerald-100 text-emerald-700", nextStep: "Prepare CAS and visa steps", icon: CheckCircle2, color: "green" },
  CAS_ISSUED: { label: "CAS Issued", badge: "bg-indigo-100 text-indigo-700", nextStep: "Start visa application", icon: FileText, color: "indigo" },
  VISA_APPLIED: { label: "Visa Applied", badge: "bg-purple-100 text-purple-700", nextStep: "Track your visa decision", icon: Send, color: "purple" },
  VISA_APPROVED: { label: "Visa Approved", badge: "bg-emerald-100 text-emerald-700", nextStep: "Prepare enrolment and travel", icon: CheckCircle2, color: "green" },
  VISA_REJECTED: { label: "Visa Rejected", badge: "bg-rose-100 text-rose-700", nextStep: "Contact your counsellor for next options", icon: ShieldAlert, color: "rose" },
  ENROLLED: { label: "Enrolled", badge: "bg-teal-100 text-teal-700", nextStep: "Complete your onboarding steps", icon: CheckCircle2, color: "teal" },
  WITHDRAWN: { label: "Withdrawn", badge: "bg-slate-100 text-slate-700", nextStep: "Explore alternative courses", icon: CircleDashed, color: "gray" },
  UNKNOWN: { label: "Unknown", badge: "bg-slate-100 text-slate-700", nextStep: "Check application status details", icon: CircleDashed, color: "gray" },
};

function formatLastActive(date: Date | null) {
  if (!date) return "No recent activity";
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.floor(deltaMs / (1000 * 60));
  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days}d ago`;
}

export default async function StudentDashboardPage() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.roleName !== "STUDENT") {
      console.error("[DASHBOARD] Invalid session:", {
        hasSession: !!session,
        userId: session?.user?.id,
        roleName: session?.user?.roleName,
      });
      redirect("/login");
    }

    console.log("[DASHBOARD] Fetching student profile for userId:", session.user.id);

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        firstName: true,
        nationality: true,
        dateOfBirth: true,
        country: true,
        onboardingCompleted: true,
        assignedCounsellor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        referredBySubAgent: {
          select: {
            agencyName: true,
            businessEmail: true,
            phone: true,
          },
        },
        applications: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            status: true,
            createdAt: true,
            course: {
              select: {
                name: true,
                university: {
                  select: {
                    name: true,
                    country: true,
                  },
                },
              },
            },
          },
        },
        preferences: {
          select: {
            preferredDestinations: true,
            preferredLevels: true,
            preferredFields: true,
          },
        },
        academicProfile: {
          select: {
            _count: {
              select: {
                qualifications: true,
              },
            },
          },
        },
        recentlyViewedCourses: true,
      },
    });

    if (!student) {
      console.error("[DASHBOARD] Student profile not found for userId:", session.user.id);
      redirect("/student/onboarding");
    }

    console.log("[DASHBOARD] Student profile loaded:", {
      studentId: student.id,
      firstName: student.firstName,
    });

  const [completion, latestChecklist, counsellorActivity, eduviStarted] = await Promise.all([
    calculateProfileCompletionDetails(student.id),
    db.documentChecklist.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        items: {
          select: { id: true, label: true, status: true },
        },
      },
    }),
    student.assignedCounsellor?.id
      ? db.activityLog.findFirst({
          where: { userId: student.assignedCounsellor.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : Promise.resolve(null),
    db.activityLog.findFirst({
      where: {
        entityType: "studentOnboarding",
        entityId: student.id,
        action: "eduvi_started",
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const verifiedCount = latestChecklist?.items.filter((item) => item.status === "VERIFIED").length ?? 0;
  const totalDocs = latestChecklist?.items.length ?? 0;
  const completionPct = totalDocs > 0 ? Math.round((verifiedCount / totalDocs) * 100) : 0;
  const pendingItems = (latestChecklist?.items ?? []).filter((item) => item.status !== "VERIFIED").slice(0, 3);

  const prefersDestinations = Array.isArray(student.preferences?.preferredDestinations) && student.preferences!.preferredDestinations.length > 0;
  const prefersLevels = Array.isArray(student.preferences?.preferredLevels) && student.preferences!.preferredLevels.length > 0;
  const prefersFields = Array.isArray(student.preferences?.preferredFields) && student.preferences!.preferredFields.length > 0;
  const hasStep2Complete = Boolean(student.dateOfBirth && student.country && prefersDestinations && prefersLevels && prefersFields);
  const hasQualifications = (student.academicProfile?._count.qualifications || 0) > 0;
  const hasEduviStarted = Boolean(eduviStarted);

  const onboardingNudges: Array<{ key: string; label: string; href: string }> = [];
  if (student.onboardingCompleted && !hasStep2Complete) {
    onboardingNudges.push({ key: "preferences", label: "Complete your study preferences", href: "/student/onboarding" });
  }
  if (student.onboardingCompleted && !hasQualifications) {
    onboardingNudges.push({ key: "qualifications", label: "Add your qualifications", href: "/student/profile/academic" });
  }
  if (student.onboardingCompleted && !hasEduviStarted) {
    onboardingNudges.push({ key: "eduvi", label: "Start chatting with Eduvi", href: "/student/messages#eduvi" });
  }

  const recentCourseIds = (Array.isArray(student.recentlyViewedCourses)
    ? student.recentlyViewedCourses.map((item) => String(item))
    : []).slice(0, 4);
  const recentCourses = recentCourseIds.length
    ? await db.course.findMany({
        where: { id: { in: recentCourseIds }, isActive: true },
        select: {
          id: true,
          name: true,
          tuitionFee: true,
          currency: true,
          university: {
            select: {
              name: true,
              country: true,
            },
          },
        },
      })
    : [];

  const recentCoursesById = new Map(recentCourses.map((course) => [course.id, course]));
  const orderedRecentCourses = recentCourseIds
    .map((id) => recentCoursesById.get(id))
    .filter((course): course is NonNullable<typeof course> => Boolean(course));

  const circumference = 2 * Math.PI * 42;
  const strokeOffset = circumference * (1 - completionPct / 100);

  const pendingMockInterviews = await db.mockInterview.count({
    where: {
      studentId: student.id,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
  });

  return (
    <main className="student-dashboard-bg mx-auto w-full max-w-7xl space-y-6 rounded-3xl p-1">
      <section className="glass-card rounded-2xl p-6">
        <TimeGreeting firstName={student.firstName} />
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Welcome back. Here is your progress across applications and documents.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            Profile completion: {completion.percentage}%
              </span>
              <span className="rounded-full bg-amber-100/90 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Documents verified: {verifiedCount}/{totalDocs}
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-white/10">
              <div
                className="h-full rounded-full gold-gradient transition-all duration-500"
                style={{ width: `${Math.max(5, Math.min(100, completion.percentage))}%` }}
              />
            </div>
          </div>
          <Link
            href={completion.firstIncompleteHref}
            className="gradient-btn inline-flex h-10 items-center px-4 text-sm font-semibold"
          >
            Complete Your Profile
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-medium text-[#1B2A4A] dark:border-white/15 dark:bg-white/5 dark:text-slate-200">Quick actions</span>
          <Link href="/student/courses" className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-semibold text-[#1B2A4A] hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">Browse Courses</Link>
          <Link href="/student/documents" className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-semibold text-[#1B2A4A] hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">Upload Docs</Link>
          <Link href="/student/messages" className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-semibold text-[#1B2A4A] hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">Message Counsellor</Link>
        </div>
      </section>

      {onboardingNudges.length > 0 ? (
        <section className="glass-card rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <h2 className="text-base font-semibold text-amber-900">Continue setup</h2>
          <div className="mt-3 space-y-2">
            {onboardingNudges.map((nudge) => (
              <Link key={nudge.key} href={nudge.href} className="block text-sm font-medium text-amber-800 hover:underline">
                {nudge.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {student.applications.length === 0 ? (
          <article className="glass-card rounded-2xl p-5 lg:col-span-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">No active applications yet.</p>
            <Link href="/student/courses" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">
              Explore courses
            </Link>
          </article>
        ) : (
          student.applications.map((application) => {
            const statusMeta =
              STATUS_UI[application.status as AppStatus] ??
              STATUS_UI.SUBMITTED ??
              STATUS_UI.UNKNOWN ??
              { icon: null, label: application.status, color: "gray", badge: "bg-slate-100 text-slate-700", nextStep: "Check application status details" };
            const StatusIcon = statusMeta.icon;

            return (
              <article key={application.id} className="glass-card rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{application.course.name}</p>
                    <p className="text-xs text-slate-500">{application.course.university.name} • {application.course.university.country}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badge}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                  {StatusIcon ? <StatusIcon className="mt-0.5 h-4 w-4 text-slate-500" /> : null}
                  <span>{statusMeta.nextStep}</span>
                </div>
                <Link href="/student/applications" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline">
                  View application details
                </Link>
              </article>
            );
          })
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={completion.firstIncompleteHref} className="glass-card rounded-2xl p-4 text-sm font-semibold text-[#1E3A5F] transition-all duration-200 hover:-translate-y-1 dark:text-slate-100">
          Complete Profile
        </Link>
        <Link href="/student/courses" className="glass-card rounded-2xl p-4 text-sm font-semibold text-[#1E3A5F] transition-all duration-200 hover:-translate-y-1 dark:text-slate-100">
          Search Courses
        </Link>
        <Link href="/student/documents" className="glass-card rounded-2xl p-4 text-sm font-semibold text-[#1E3A5F] transition-all duration-200 hover:-translate-y-1 dark:text-slate-100">
          Upload Documents
        </Link>
        <Link href="/student/messages" className="glass-card rounded-2xl p-4 text-sm font-semibold text-[#1E3A5F] transition-all duration-200 hover:-translate-y-1 dark:text-slate-100">
          Message Counsellor
        </Link>
        <Link href="/student/mock-interview" className="glass-card rounded-2xl p-4 text-sm font-semibold text-[#1E3A5F] transition-all duration-200 hover:-translate-y-1 dark:text-slate-100">
          <span className="inline-flex items-center gap-2"><Mic className="h-4 w-4" /> Mock Interview</span>
          <span className="mt-1 block text-xs font-medium text-slate-500">Pending: {pendingMockInterviews}</span>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Documents Status</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 100 100" className="h-28 w-28">
                <defs>
                  <linearGradient id="doc-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5A623" />
                    <stop offset="100%" stopColor="#ff6b35" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" stroke="#E2E8F0" strokeWidth="10" fill="none" className="dark:stroke-slate-700" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="url(#doc-progress-gradient)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{completionPct}%</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Verified</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{completionPct}% complete</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Keep uploading pending checklist items.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pendingItems.length === 0 ? (
              <p className="text-sm text-emerald-700">All checklist items are verified.</p>
            ) : (
              pendingItems.map((item) => (
                <Link key={item.id} href="/student/documents" className="block text-sm text-blue-700 hover:underline">
                  {item.label}
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Your Counsellor</h2>
          {student.assignedCounsellor ? (
            <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{student.assignedCounsellor.name || "Assigned Counsellor"}</p>
              <p>{student.assignedCounsellor.email}</p>
              {student.assignedCounsellor.phone ? <p>{student.assignedCounsellor.phone}</p> : null}
              <p className="text-xs text-slate-500 dark:text-slate-400">{formatLastActive(counsellorActivity?.createdAt || null)}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">A counsellor will be assigned shortly.</p>
          )}

          {student.referredBySubAgent ? (
            <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
              <p className="font-medium text-slate-900 dark:text-slate-100">Sub-agent: {student.referredBySubAgent.agencyName}</p>
              {student.referredBySubAgent.businessEmail ? <p>{student.referredBySubAgent.businessEmail}</p> : null}
              {student.referredBySubAgent.phone ? <p>{student.referredBySubAgent.phone}</p> : null}
            </div>
          ) : null}

          <Link href="/student/messages" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
            <MessageCircle className="h-4 w-4" /> Message now
          </Link>
        </article>
      </section>

      {orderedRecentCourses.length > 0 ? (
        <section className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recently Viewed Courses</h2>
            <Link href="/student/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
              <Search className="h-4 w-4" /> Browse all
            </Link>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {orderedRecentCourses.map((course) => (
              <article key={course.id} className="rounded-xl border border-white/40 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{course.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{course.university.name} • {course.university.country}</p>
                <div className="mt-2">
                  <CurrencyDisplay
                    amount={course.tuitionFee}
                    baseCurrency={course.currency}
                    studentNationality={student.nationality || undefined}
                  />
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <Link href={`/student/courses/${course.id}`} className="font-semibold text-blue-700 hover:underline">
                    View
                  </Link>
                  <Link href={`/student/courses/${course.id}`} className="font-semibold text-emerald-700 hover:underline">
                    Apply
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
  } catch (error) {
    console.error("[DASHBOARD] Error rendering dashboard:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
