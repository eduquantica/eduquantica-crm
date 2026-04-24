import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
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

type StatusMeta = { label: string; emoji: string; nextStep: string; gradient: string; pillClass: string };

const STATUS_UI: Record<AppStatus | "UNKNOWN", StatusMeta> = {
  DRAFT: { label: "Draft", emoji: "✏️", nextStep: "Complete your application", gradient: "from-slate-400 to-slate-500", pillClass: "bg-slate-100 text-slate-700" },
  DOCUMENTS_PENDING: { label: "Docs Needed", emoji: "📂", nextStep: "Upload your required documents", gradient: "from-amber-400 to-orange-500", pillClass: "bg-amber-100 text-amber-700" },
  SUBMITTED: { label: "Submitted", emoji: "🚀", nextStep: "Await university review", gradient: "from-blue-500 to-indigo-600", pillClass: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: { label: "Under Review", emoji: "🔍", nextStep: "University is reviewing your app", gradient: "from-indigo-500 to-purple-600", pillClass: "bg-indigo-100 text-indigo-700" },
  CONDITIONAL_OFFER: { label: "Conditional Offer", emoji: "🎯", nextStep: "Complete your offer conditions", gradient: "from-yellow-400 to-amber-500", pillClass: "bg-yellow-100 text-yellow-700" },
  UNCONDITIONAL_OFFER: { label: "Unconditional Offer", emoji: "🎉", nextStep: "Prepare CAS and visa steps", gradient: "from-emerald-400 to-green-500", pillClass: "bg-emerald-100 text-emerald-700" },
  CAS_ISSUED: { label: "CAS Issued", emoji: "📜", nextStep: "Start your visa application", gradient: "from-indigo-500 to-violet-600", pillClass: "bg-indigo-100 text-indigo-700" },
  VISA_APPLIED: { label: "Visa Applied", emoji: "✈️", nextStep: "Track your visa decision", gradient: "from-purple-500 to-violet-600", pillClass: "bg-purple-100 text-purple-700" },
  VISA_APPROVED: { label: "Visa Approved", emoji: "🌍", nextStep: "Prepare travel and enrolment", gradient: "from-teal-400 to-emerald-500", pillClass: "bg-emerald-100 text-emerald-700" },
  VISA_REJECTED: { label: "Visa Rejected", emoji: "⚠️", nextStep: "Talk to your counsellor for options", gradient: "from-rose-500 to-red-600", pillClass: "bg-rose-100 text-rose-700" },
  ENROLLED: { label: "Enrolled 🎓", emoji: "🎓", nextStep: "Complete onboarding steps", gradient: "from-violet-500 to-purple-600", pillClass: "bg-violet-100 text-violet-700" },
  WITHDRAWN: { label: "Withdrawn", emoji: "↩️", nextStep: "Explore alternative courses", gradient: "from-slate-400 to-slate-500", pillClass: "bg-slate-100 text-slate-700" },
  UNKNOWN: { label: "In Progress", emoji: "⏳", nextStep: "Check application status details", gradient: "from-slate-400 to-slate-500", pillClass: "bg-slate-100 text-slate-700" },
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

const QUICK_ACTIONS = [
  { href: "/student/profile", emoji: "👤", label: "My Profile", sub: "Update details", color: "from-violet-500 to-purple-600" },
  { href: "/student/courses", emoji: "🔍", label: "Browse Courses", sub: "Find your future", color: "from-indigo-500 to-blue-600" },
  { href: "/student/documents", emoji: "📁", label: "Documents", sub: "Upload & manage", color: "from-blue-500 to-cyan-600" },
  { href: "/student/messages", emoji: "💬", label: "Messages", sub: "Talk to your team", color: "from-fuchsia-500 to-pink-600" },
  { href: "/student/mock-interview", emoji: "🎤", label: "Mock Interview", sub: "Practice makes perfect", color: "from-rose-500 to-orange-500" },
  { href: "/student/scholarships", emoji: "🏆", label: "Scholarships", sub: "Find funding", color: "from-amber-500 to-yellow-500" },
] as const;

export default async function StudentDashboardPage() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.roleName !== "STUDENT") {
      redirect("/login");
    }

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
          select: { id: true, name: true, email: true, phone: true },
        },
        referredBySubAgent: {
          select: { agencyName: true, businessEmail: true, phone: true },
        },
        applications: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            applicationRef: true,
            status: true,
            createdAt: true,
            course: {
              select: {
                name: true,
                university: { select: { name: true, country: true } },
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
          select: { _count: { select: { qualifications: true } } },
        },
        recentlyViewedCourses: true,
      },
    });

    if (!student) redirect("/student/onboarding");

    const [completion, latestChecklist, counsellorActivity, eduviStarted] = await Promise.all([
      calculateProfileCompletionDetails(student.id),
      db.documentChecklist.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          items: { select: { id: true, label: true, status: true } },
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

    const verifiedCount = latestChecklist?.items.filter((i) => i.status === "VERIFIED").length ?? 0;
    const totalDocs = latestChecklist?.items.length ?? 0;
    const completionPct = totalDocs > 0 ? Math.round((verifiedCount / totalDocs) * 100) : 0;
    const pendingItems = (latestChecklist?.items ?? []).filter((i) => i.status !== "VERIFIED").slice(0, 3);

    const prefersDestinations = Array.isArray(student.preferences?.preferredDestinations) && student.preferences!.preferredDestinations.length > 0;
    const prefersLevels = Array.isArray(student.preferences?.preferredLevels) && student.preferences!.preferredLevels.length > 0;
    const prefersFields = Array.isArray(student.preferences?.preferredFields) && student.preferences!.preferredFields.length > 0;
    const hasStep2Complete = Boolean(student.dateOfBirth && student.country && prefersDestinations && prefersLevels && prefersFields);
    const hasQualifications = (student.academicProfile?._count.qualifications || 0) > 0;
    const hasEduviStarted = Boolean(eduviStarted);

    const onboardingNudges: Array<{ key: string; emoji: string; label: string; href: string }> = [];
    if (student.onboardingCompleted && !hasStep2Complete) {
      onboardingNudges.push({ key: "preferences", emoji: "🎯", label: "Tell us your study preferences", href: "/student/onboarding" });
    }
    if (student.onboardingCompleted && !hasQualifications) {
      onboardingNudges.push({ key: "qualifications", emoji: "📚", label: "Add your academic qualifications", href: "/student/profile/academic" });
    }
    if (student.onboardingCompleted && !hasEduviStarted) {
      onboardingNudges.push({ key: "eduvi", emoji: "🤖", label: "Say hi to Eduvi, your AI guide", href: "/student/messages#eduvi" });
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
            university: { select: { name: true, country: true } },
          },
        })
      : [];

    const recentCoursesById = new Map(recentCourses.map((c) => [c.id, c]));
    const orderedRecentCourses = recentCourseIds
      .map((id) => recentCoursesById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const circumference = 2 * Math.PI * 42;
    const strokeOffset = circumference * (1 - completionPct / 100);

    const pendingMockInterviews = await db.mockInterview.count({
      where: { studentId: student.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    });

    return (
      <main className="mx-auto w-full max-w-7xl space-y-6 p-1">

        {/* Hero greeting */}
        <section
          className="relative overflow-hidden rounded-3xl p-6 md:p-8"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #3730a3 100%)" }}
        >
          {/* background blobs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-violet-300/20 blur-2xl" />

          <TimeGreeting firstName={student.firstName} />
          <p className="mt-1 text-sm text-violet-200">Here&apos;s everything happening with your journey today.</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📊 Profile {completion.percentage}% done
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📁 {verifiedCount}/{totalDocs} docs verified
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📋 {student.applications.length} active application{student.applications.length !== 1 ? "s" : ""}
            </span>
            {pendingMockInterviews > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/80 px-3 py-1.5 text-xs font-semibold text-amber-900 backdrop-blur">
                🎤 {pendingMockInterviews} mock interview{pendingMockInterviews !== 1 ? "s" : ""} pending
              </span>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-violet-200 mb-1.5">
              <span>Profile completion</span>
              <span>{completion.percentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-700"
                style={{ width: `${Math.max(4, completion.percentage)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={completion.firstIncompleteHref} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors">
              Finish Profile →
            </Link>
            <Link href="/student/courses" className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors">
              🔍 Browse Courses
            </Link>
            <Link href="/student/messages" className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors">
              💬 Message Counsellor
            </Link>
          </div>
        </section>

        {/* Onboarding nudges */}
        {onboardingNudges.length > 0 && (
          <section className="glass-card p-5">
            <h2 className="text-sm font-bold text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <span>⚡</span> Keep the momentum going!
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {onboardingNudges.map((nudge) => (
                <Link
                  key={nudge.key}
                  href={nudge.href}
                  className="flex items-center gap-3 rounded-2xl border border-violet-100 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-950/30 px-4 py-3 text-sm font-medium text-violet-900 dark:text-violet-200 hover:border-violet-300 hover:bg-violet-50 transition-all"
                >
                  <span className="text-xl">{nudge.emoji}</span>
                  <span>{nudge.label}</span>
                  <span className="ml-auto text-violet-400">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Applications */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>📋</span> My Applications
            </h2>
            <Link href="/student/applications" className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
              View all →
            </Link>
          </div>

          {student.applications.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-3xl mb-2">🌍</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No applications yet</p>
              <p className="text-xs text-slate-500 mt-1">Find your dream course and hit Apply!</p>
              <Link
                href="/student/courses"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
              >
                🔍 Explore Courses
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {student.applications.map((application) => {
                const meta = STATUS_UI[application.status as AppStatus] ?? STATUS_UI.UNKNOWN;
                return (
                  <article
                    key={application.id}
                    className="glass-card overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className={`h-1.5 w-full bg-gradient-to-r ${meta.gradient}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{application.course.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{application.course.university.name} · {application.course.university.country}</p>
                          {application.applicationRef && (
                            <p className="mt-0.5 text-[10px] font-mono text-violet-500 dark:text-violet-400">{application.applicationRef}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.pillClass}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">{meta.nextStep}</p>
                      <Link
                        href={`/student/applications/${application.id}`}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                      >
                        View details →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>⚡</span> Quick Actions
          </h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group glass-card flex flex-col items-center gap-2 p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${action.color} text-2xl shadow-md group-hover:scale-110 transition-transform`}>
                  {action.emoji}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{action.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{action.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Documents + Counsellor */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Documents ring */}
          <article className="glass-card p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <span>📁</span> Documents Status
            </h2>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0 h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                  <defs>
                    <linearGradient id="doc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="42" stroke="#e5e7eb" strokeWidth="10" fill="none" className="dark:stroke-slate-700" />
                  <circle
                    cx="50" cy="50" r="42"
                    stroke="url(#doc-grad)"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-black text-violet-700 dark:text-violet-300">{completionPct}%</p>
                  <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">verified</p>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{verifiedCount} of {totalDocs} verified</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">Keep going — you&apos;re almost there!</p>
                {pendingItems.length === 0 ? (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✅ All checklist items verified</p>
                ) : (
                  <div className="space-y-1.5">
                    {pendingItems.map((item) => (
                      <Link key={item.id} href="/student/documents" className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400">
                        <span className="text-amber-500">●</span> {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Link
              href="/student/documents"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              📤 Upload Documents
            </Link>
          </article>

          {/* Counsellor card */}
          <article className="glass-card p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <span>🎓</span> Your Counsellor
            </h2>
            {student.assignedCounsellor ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white shadow-md"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                  >
                    {(student.assignedCounsellor.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                      {student.assignedCounsellor.name || "Assigned Counsellor"}
                    </p>
                    <p className="truncate text-xs text-slate-500">{student.assignedCounsellor.email}</p>
                    {student.assignedCounsellor.phone && (
                      <p className="text-xs text-slate-500">{student.assignedCounsellor.phone}</p>
                    )}
                    <p className="text-[10px] font-medium text-violet-500 dark:text-violet-400 mt-0.5">
                      {formatLastActive(counsellorActivity?.createdAt || null)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-2xl">
                  ⏳
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Being assigned...</p>
                  <p className="text-xs text-slate-500">Your counsellor will be with you soon.</p>
                </div>
              </div>
            )}

            {student.referredBySubAgent && (
              <div className="rounded-2xl border border-violet-100 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-950/30 p-3 text-xs text-slate-700 dark:text-slate-200 mb-3">
                <p className="font-bold text-violet-700 dark:text-violet-300">🏢 {student.referredBySubAgent.agencyName}</p>
                {student.referredBySubAgent.businessEmail && <p className="text-slate-500 mt-0.5">{student.referredBySubAgent.businessEmail}</p>}
              </div>
            )}

            <Link
              href="/student/messages"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Message Now
            </Link>
          </article>
        </section>

        {/* Recently viewed courses */}
        {orderedRecentCourses.length > 0 && (
          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>👀</span> Recently Viewed Courses
              </h2>
              <Link href="/student/courses" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
                <Search className="h-3.5 w-3.5" /> Browse all
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {orderedRecentCourses.map((course) => (
                <article
                  key={course.id}
                  className="group rounded-2xl border border-violet-100/60 dark:border-violet-800/30 bg-white/60 dark:bg-white/5 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700/50"
                >
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{course.name}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{course.university.name}</p>
                  <p className="text-[10px] text-slate-400">{course.university.country}</p>
                  <div className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    <CurrencyDisplay
                      amount={course.tuitionFee}
                      baseCurrency={course.currency}
                      studentNationality={student.nationality || undefined}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Link href={`/student/courses/${course.id}`} className="text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400">
                      View →
                    </Link>
                    <Link
                      href={`/student/courses/${course.id}`}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                    >
                      Apply
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
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
