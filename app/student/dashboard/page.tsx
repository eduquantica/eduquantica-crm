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

type StatusMeta = {
  label: string;
  emoji: string;
  nextStep: string;
  barColor: string;
  pillClass: string;
};

const STATUS_UI: Record<AppStatus | "UNKNOWN", StatusMeta> = {
  DRAFT:              { label: "Draft",             emoji: "✏️",  nextStep: "Complete your application",           barColor: "#94a3b8", pillClass: "bg-slate-100 text-slate-600" },
  DOCUMENTS_PENDING:  { label: "Docs Needed",        emoji: "📂",  nextStep: "Upload your required documents",       barColor: "#f59e0b", pillClass: "bg-amber-100 text-amber-700" },
  SUBMITTED:          { label: "Submitted",          emoji: "🚀",  nextStep: "Awaiting university review",           barColor: "#1B2A4A", pillClass: "bg-blue-50 text-[#1B2A4A]" },
  UNDER_REVIEW:       { label: "Under Review",       emoji: "🔍",  nextStep: "University is reviewing your app",    barColor: "#2f4f86", pillClass: "bg-blue-50 text-[#2f4f86]" },
  CONDITIONAL_OFFER:  { label: "Conditional Offer",  emoji: "🎯",  nextStep: "Complete your offer conditions",       barColor: "#F5A623", pillClass: "bg-amber-100 text-amber-800" },
  UNCONDITIONAL_OFFER:{ label: "Offer Received! 🎉", emoji: "🏅",  nextStep: "Prepare CAS and visa documents",      barColor: "#10b981", pillClass: "bg-emerald-100 text-emerald-700" },
  CAS_ISSUED:         { label: "CAS Issued",         emoji: "📜",  nextStep: "Start your visa application",          barColor: "#1B2A4A", pillClass: "bg-slate-100 text-[#1B2A4A]" },
  VISA_APPLIED:       { label: "Visa Applied",       emoji: "✈️",  nextStep: "Track your visa decision",            barColor: "#8b5cf6", pillClass: "bg-purple-100 text-purple-700" },
  VISA_APPROVED:      { label: "Visa Approved",      emoji: "🌍",  nextStep: "Book travel and prepare enrolment",   barColor: "#10b981", pillClass: "bg-emerald-100 text-emerald-700" },
  VISA_REJECTED:      { label: "Visa Rejected",      emoji: "⚠️",  nextStep: "Talk to your counsellor for options", barColor: "#ef4444", pillClass: "bg-rose-100 text-rose-700" },
  ENROLLED:           { label: "Enrolled",           emoji: "🎓",  nextStep: "Complete your onboarding steps",      barColor: "#10b981", pillClass: "bg-teal-100 text-teal-700" },
  WITHDRAWN:          { label: "Withdrawn",          emoji: "↩️",  nextStep: "Explore alternative courses",          barColor: "#94a3b8", pillClass: "bg-slate-100 text-slate-600" },
  UNKNOWN:            { label: "In Progress",        emoji: "⏳",  nextStep: "Check your application status",       barColor: "#94a3b8", pillClass: "bg-slate-100 text-slate-600" },
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
  { href: "/student/profile",        emoji: "👤", label: "My Profile",      sub: "Update details",        bg: "#1B2A4A" },
  { href: "/student/courses",        emoji: "🔍", label: "Browse Courses",   sub: "Find your future",      bg: "#2f4f86" },
  { href: "/student/documents",      emoji: "📁", label: "Documents",        sub: "Upload & manage",       bg: "#F5A623", dark: true },
  { href: "/student/messages",       emoji: "💬", label: "Messages",         sub: "Talk to your team",     bg: "#1B2A4A" },
  { href: "/student/mock-interview", emoji: "🎤", label: "Mock Interview",   sub: "Practice & prepare",    bg: "#2f4f86" },
  { href: "/student/scholarships",   emoji: "🏆", label: "Scholarships",     sub: "Find funding",          bg: "#F5A623", dark: true },
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
        where: { entityType: "studentOnboarding", entityId: student.id, action: "eduvi_started" },
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
    if (student.onboardingCompleted && !hasStep2Complete)
      onboardingNudges.push({ key: "preferences", emoji: "🎯", label: "Tell us your study preferences", href: "/student/onboarding" });
    if (student.onboardingCompleted && !hasQualifications)
      onboardingNudges.push({ key: "qualifications", emoji: "📚", label: "Add your academic qualifications", href: "/student/profile/academic" });
    if (student.onboardingCompleted && !hasEduviStarted)
      onboardingNudges.push({ key: "eduvi", emoji: "🤖", label: "Say hi to Eduvi, your AI guide", href: "/student/messages#eduvi" });

    const recentCourseIds = (Array.isArray(student.recentlyViewedCourses)
      ? student.recentlyViewedCourses.map((item) => String(item))
      : []).slice(0, 4);
    const recentCourses = recentCourseIds.length
      ? await db.course.findMany({
          where: { id: { in: recentCourseIds }, isActive: true },
          select: {
            id: true, name: true, tuitionFee: true, currency: true,
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
      <div className="w-full px-5 py-6 sm:px-7 space-y-6">

        {/* ── Hero banner ── */}
        <section
          className="relative overflow-hidden rounded-2xl p-6 md:p-8"
          style={{ background: "linear-gradient(135deg, #1B2A4A 0%, #162643 55%, #0d1f3c 100%)" }}
        >
          {/* decorative glows */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #F5A623, transparent)" }} />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-32 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #F5A623, transparent)" }} />

          <TimeGreeting firstName={student.firstName} />
          <p className="mt-1 text-sm text-white/55">Here&apos;s everything happening with your journey today.</p>

          {/* Stat chips */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📊 Profile {completion.percentage}% done
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📁 {verifiedCount}/{totalDocs} docs verified
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📋 {student.applications.length} application{student.applications.length !== 1 ? "s" : ""}
            </span>
            {pendingMockInterviews > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[#1B2A4A]" style={{ background: "#F5A623" }}>
                🎤 {pendingMockInterviews} mock interview{pendingMockInterviews !== 1 ? "s" : ""} pending
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-white/45 mb-1.5">
              <span>Profile completion</span>
              <span>{completion.percentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, completion.percentage)}%`, background: "linear-gradient(90deg, #F5A623, #e8930f)" }}
              />
            </div>
          </div>

          {/* CTA row */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={completion.firstIncompleteHref}
              className="rounded-xl px-4 py-2 text-xs font-black text-[#1B2A4A] hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
            >
              Finish Profile →
            </Link>
            <Link href="/student/courses" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/18 transition-all">
              🔍 Browse Courses
            </Link>
            <Link href="/student/messages" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/18 transition-all">
              💬 Message Counsellor
            </Link>
          </div>
        </section>

        {/* ── Onboarding nudges ── */}
        {onboardingNudges.length > 0 && (
          <section className="glass-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1B2A4A]">
              ⚡ Keep the momentum going!
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {onboardingNudges.map((nudge) => (
                <Link
                  key={nudge.key}
                  href={nudge.href}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium text-[#1B2A4A] hover:border-[#1B2A4A]/30 hover:bg-[#f0f4fa] transition-all"
                  style={{ borderColor: "rgba(27,42,74,0.12)", background: "rgba(27,42,74,0.03)" }}
                >
                  <span className="text-xl">{nudge.emoji}</span>
                  <span className="flex-1">{nudge.label}</span>
                  <span className="text-[#F5A623] font-bold">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Applications ── */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#1B2A4A]">
              📋 My Applications
            </h2>
            <Link href="/student/applications" className="text-xs font-semibold text-[#1B2A4A] hover:text-[#F5A623] transition-colors">
              View all →
            </Link>
          </div>

          {student.applications.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-3xl mb-2">🌍</p>
              <p className="text-sm font-bold text-slate-700">No applications yet</p>
              <p className="text-xs text-slate-500 mt-1">Find your dream course and hit Apply!</p>
              <Link
                href="/student/courses"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}
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
                    className="glass-card overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    {/* colored top strip */}
                    <div className="h-1.5 w-full" style={{ background: meta.barColor }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#1B2A4A]">{application.course.name}</p>
                          <p className="text-xs text-slate-500">{application.course.university.name} · {application.course.university.country}</p>
                          {application.applicationRef && (
                            <p className="mt-0.5 text-[10px] font-mono text-amber-600">{application.applicationRef}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.pillClass}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-600">{meta.nextStep}</p>
                      <Link
                        href={`/student/applications/${application.id}`}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#1B2A4A] hover:text-[#F5A623] transition-colors"
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

        {/* ── Quick Actions ── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1B2A4A]">
            ⚡ Quick Actions
          </h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group glass-card flex flex-col items-center gap-3 p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-md group-hover:scale-110 transition-transform duration-200"
                  style={{ background: action.bg }}
                >
                  {action.emoji}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1B2A4A]">{action.label}</p>
                  <p className="text-[10px] text-slate-400">{action.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Documents + Counsellor ── */}
        <section className="grid gap-4 lg:grid-cols-2">

          {/* Documents ring */}
          <article className="glass-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1B2A4A]">
              📁 Documents Status
            </h2>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0 h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                  <defs>
                    <linearGradient id="doc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1B2A4A" />
                      <stop offset="100%" stopColor="#2f4f86" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="42" stroke="#e5e7eb" strokeWidth="10" fill="none" className="dark:stroke-slate-700" />
                  <circle
                    cx="50" cy="50" r="42"
                    stroke="url(#doc-grad)"
                    strokeWidth="10" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-black text-[#1B2A4A]">{completionPct}%</p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">verified</p>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1B2A4A]">{verifiedCount} of {totalDocs} verified</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  {completionPct === 100 ? "All documents verified 🎉" : "Keep uploading to boost your application!"}
                </p>
                {pendingItems.length === 0 ? (
                  <p className="text-xs font-semibold text-emerald-600">✅ All items complete</p>
                ) : (
                  <div className="space-y-1.5">
                    {pendingItems.map((item) => (
                      <Link key={item.id} href="/student/documents" className="flex items-center gap-1.5 text-xs text-[#1B2A4A] hover:text-[#F5A623] transition-colors">
                        <span className="text-amber-400">●</span> {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Link
              href="/student/documents"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-[#1B2A4A] transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
            >
              📤 Upload Documents
            </Link>
          </article>

          {/* Counsellor */}
          <article className="glass-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1B2A4A]">
              🎓 Your Counsellor
            </h2>
            {student.assignedCounsellor ? (
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-[#1B2A4A] shadow"
                  style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
                >
                  {(student.assignedCounsellor.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#1B2A4A]">
                    {student.assignedCounsellor.name || "Assigned Counsellor"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{student.assignedCounsellor.email}</p>
                  {student.assignedCounsellor.phone && <p className="text-xs text-slate-500">{student.assignedCounsellor.phone}</p>}
                  <p className="text-[10px] font-semibold text-amber-600 mt-0.5">
                    {formatLastActive(counsellorActivity?.createdAt || null)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">⏳</div>
                <div>
                  <p className="text-sm font-bold text-[#1B2A4A]">Being assigned...</p>
                  <p className="text-xs text-slate-500">Your counsellor will be with you soon.</p>
                </div>
              </div>
            )}

            {student.referredBySubAgent && (
              <div
                className="rounded-xl border p-3 text-xs text-slate-700 mb-4"
                style={{ borderColor: "rgba(27,42,74,0.1)", background: "rgba(27,42,74,0.03)" }}
              >
                <p className="font-bold text-[#1B2A4A]">🏢 {student.referredBySubAgent.agencyName}</p>
                {student.referredBySubAgent.businessEmail && <p className="text-slate-500 mt-0.5">{student.referredBySubAgent.businessEmail}</p>}
              </div>
            )}

            <Link
              href="/student/messages"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #1B2A4A, #2f4f86)" }}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Message Now
            </Link>
          </article>
        </section>

        {/* ── Recently viewed courses ── */}
        {orderedRecentCourses.length > 0 && (
          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#1B2A4A]">
                👀 Recently Viewed Courses
              </h2>
              <Link href="/student/courses" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B2A4A] hover:text-[#F5A623] transition-colors">
                <Search className="h-3.5 w-3.5" /> Browse all
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {orderedRecentCourses.map((course) => (
                <article
                  key={course.id}
                  className="group rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: "rgba(27,42,74,0.09)", background: "rgba(255,255,255,0.7)" }}
                >
                  <p className="text-sm font-bold text-[#1B2A4A] line-clamp-2">{course.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{course.university.name}</p>
                  <p className="text-[10px] text-slate-400">{course.university.country}</p>
                  <div className="mt-2 text-xs font-semibold text-[#1B2A4A]">
                    <CurrencyDisplay
                      amount={course.tuitionFee}
                      baseCurrency={course.currency}
                      studentNationality={student.nationality || undefined}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Link href={`/student/courses/${course.id}`} className="text-xs font-bold text-[#1B2A4A] hover:text-[#F5A623] transition-colors">
                      View →
                    </Link>
                    <Link
                      href={`/student/courses/${course.id}`}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-[#1B2A4A]"
                      style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
                    >
                      Apply
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  } catch (error) {
    console.error("[DASHBOARD] Error rendering dashboard:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
