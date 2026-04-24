"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  Coins,
  LogOut,
  FileText,
  Folder,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Search,
  Star,
  User,
  X,
  Settings,
  Mic,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import NotificationsBell from "@/components/ui/NotificationsBell";
import { cn } from "@/lib/cn";
import StudentFloatingChatButton from "./StudentFloatingChatButton";

type StudentPortalShellProps = {
  children: React.ReactNode;
  studentName: string;
  studentEmail: string;
  studentId: string;
  profileCompletion: number;
  firstIncompleteHref: string;
  unreadEduviCount: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  startsWith?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home",           href: "/student/dashboard",     icon: Home,          emoji: "🏠", startsWith: ["/student/dashboard"] },
  { label: "My Profile",     href: "/student/profile",       icon: User,          emoji: "👤", startsWith: ["/student/profile"] },
  { label: "Course Search",  href: "/student/courses",       icon: Search,        emoji: "🔍", startsWith: ["/student/courses"] },
  { label: "My Wishlist",    href: "/student/wishlist",      icon: Heart,         emoji: "💜", startsWith: ["/student/wishlist"] },
  { label: "Applications",   href: "/student/applications",  icon: FileText,      emoji: "📋", startsWith: ["/student/applications"] },
  { label: "Documents",      href: "/student/documents",     icon: Folder,        emoji: "📁", startsWith: ["/student/documents"] },
  { label: "My CV",          href: "/student/cv-builder",    icon: FileText,      emoji: "📄", startsWith: ["/student/cv-builder"] },
  { label: "Finance",        href: "/student/finance",       icon: Coins,         emoji: "💰", startsWith: ["/student/finance"] },
  { label: "Scholarships",   href: "/student/scholarships",  icon: Star,          emoji: "🎓", startsWith: ["/student/scholarships"] },
  { label: "Mock Interview", href: "/student/mock-interview",icon: Mic,           emoji: "🎤", startsWith: ["/student/mock-interview"] },
  { label: "Messages",       href: "/student/messages",      icon: MessageCircle, emoji: "💬", startsWith: ["/student/messages"] },
  { label: "Notifications",  href: "/student/notifications", icon: Bell,          emoji: "🔔", startsWith: ["/student/notifications"] },
];

const PAGE_TITLES: Array<{ match: string; title: string; emoji: string }> = [
  { match: "/student/dashboard",     title: "Dashboard",      emoji: "🏠" },
  { match: "/student/profile",       title: "My Profile",     emoji: "👤" },
  { match: "/student/courses",       title: "Course Search",  emoji: "🔍" },
  { match: "/student/wishlist",      title: "My Wishlist",    emoji: "💜" },
  { match: "/student/applications",  title: "Applications",   emoji: "📋" },
  { match: "/student/documents",     title: "Documents",      emoji: "📁" },
  { match: "/student/cv-builder",    title: "My CV",          emoji: "📄" },
  { match: "/student/finance",       title: "Finance",        emoji: "💰" },
  { match: "/student/scholarships",  title: "Scholarships",   emoji: "🎓" },
  { match: "/student/mock-interview",title: "Mock Interview", emoji: "🎤" },
  { match: "/student/messages",      title: "Messages",       emoji: "💬" },
  { match: "/student/notifications", title: "Notifications",  emoji: "🔔" },
  { match: "/student/settings",      title: "Settings",       emoji: "⚙️" },
];

function getPageMeta(pathname: string) {
  return PAGE_TITLES.find((p) => pathname.startsWith(p.match)) ?? { title: "Student Portal", emoji: "✨" };
}

function completionColor(pct: number) {
  if (pct === 100) return "#10b981";
  if (pct >= 70) return "#8b5cf6";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function StudentPortalShell({
  children,
  studentName,
  studentEmail,
  studentId,
  profileCompletion,
  firstIncompleteHref,
  unreadEduviCount,
}: StudentPortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(profileCompletion < 70);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dismissKey = `student-profile-banner-dismissed-until-${studentId}`;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(dismissKey);
    const hiddenUntil = raw ? Number(raw) : 0;
    setBannerVisible(profileCompletion < 70 && hiddenUntil <= Date.now());
  }, [dismissKey, profileCompletion]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname]);

  function isActive(item: NavItem) {
    const patterns = item.startsWith || [item.href];
    return patterns.some((p) => pathname === p || pathname.startsWith(p));
  }

  function dismissBannerFor24h() {
    window.localStorage.setItem(dismissKey, String(Date.now() + 86400000));
    setBannerVisible(false);
  }

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col" style={{ background: "linear-gradient(190deg, #2e1065 0%, #3b0764 32%, #1e1b4b 70%, #1e1b4b 100%)" }}>

        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">EduQuantica</p>
              <p className="text-xs text-white/50 -mt-0.5">Student Portal</p>
            </div>
          </div>

          {/* Profile summary */}
          <Link href="/student/profile" className="block rounded-2xl p-3.5 transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow shadow-violet-900/40">
                {initials(studentName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{studentName}</p>
                <p className="truncate text-xs text-white/40">{studentEmail}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0" />
            </div>
            {/* Completion bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/40 font-medium">Profile {profileCompletion}%</span>
                {profileCompletion === 100 && <span className="text-[10px] text-emerald-400 font-semibold">Complete ✓</span>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${profileCompletion}%`, background: completionColor(profileCompletion) }}
                />
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">Navigation</p>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-white/14 text-white shadow-sm"
                    : "text-white/55 hover:bg-white/09 hover:text-white/90 hover:translate-x-0.5",
                )}
              >
                <span className="text-base leading-none w-5 text-center">{item.emoji}</span>
                <span className="flex-1">{item.label}</span>
                {active && <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom settings */}
        <div className="px-3 pb-5 pt-2 border-t border-white/10">
          <Link
            href="/student/settings"
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/09 hover:text-white/90 transition-all"
          >
            <span className="text-base leading-none w-5 text-center">⚙️</span>
            Settings
          </Link>
          <button
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="mt-0.5 w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/40 hover:bg-red-500/15 hover:text-red-300 transition-all"
          >
            <LogOut className="h-4 w-4 ml-0.5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(145deg, #f5f3ff 0%, #ede9fe 35%, #eef2ff 65%, #f0f9ff 100%)" }}>
      <div className="flex min-h-screen">

        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-0 h-screen overflow-hidden">
            <SidebarContent />
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Close"
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-full overflow-y-auto">
                <SidebarContent />
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Topbar */}
          <header className="sticky top-0 z-30 border-b border-violet-100/60 backdrop-blur-xl" style={{ background: "rgba(250,248,255,0.88)" }}>
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-100 bg-white/70 text-violet-700 lg:hidden hover:bg-violet-50 transition"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <h1 className="truncate text-base font-bold text-slate-900">
                  <span className="mr-1.5">{pageMeta.emoji}</span>
                  {pageMeta.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <NotificationsBell />

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex h-9 items-center gap-2 rounded-xl border border-violet-100 bg-white/70 px-2 hover:bg-violet-50 transition"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white shadow shadow-violet-200">
                      {initials(studentName)}
                    </span>
                    <span className="hidden max-w-[100px] truncate text-sm font-semibold text-slate-700 sm:block">
                      {studentName.split(" ")[0]}
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-900">{studentName}</p>
                        <p className="text-xs text-slate-400 truncate">{studentEmail}</p>
                      </div>
                      <div className="py-1">
                        <Link href="/student/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-violet-50 transition">
                          <User className="h-3.5 w-3.5 text-violet-500" /> My Profile
                        </Link>
                        <Link href="/student/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-violet-50 transition">
                          <Settings className="h-3.5 w-3.5 text-violet-500" /> Settings
                        </Link>
                      </div>
                      <div className="border-t border-slate-100 py-1">
                        <button
                          onClick={() => void signOut({ callbackUrl: "/login" })}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 transition"
                        >
                          <LogOut className="h-3.5 w-3.5" /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profile completion banner */}
            {profileCompletion < 70 && bannerVisible && (
              <div className="border-t border-violet-100 px-4 py-2.5 sm:px-6" style={{ background: "rgba(237,233,254,0.85)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-violet-900">
                    ✨ Your profile is <strong>{profileCompletion}%</strong> complete — finish it to unlock personalised course matches.
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={firstIncompleteHref}
                      className="inline-flex h-8 items-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-xs font-bold text-white hover:opacity-90 transition shadow shadow-violet-200"
                    >
                      Finish Profile →
                    </Link>
                    <button
                      onClick={dismissBannerFor24h}
                      className="inline-flex h-8 items-center rounded-xl border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition"
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            )}
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>

      <StudentFloatingChatButton unreadCount={unreadEduviCount} />
    </div>
  );
}
