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
  GraduationCap,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Mic,
  Search,
  Settings,
  Star,
  User,
  X,
  ChevronDown,
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
  { label: "Home",           href: "/student/dashboard",      icon: Home,          emoji: "🏠", startsWith: ["/student/dashboard"] },
  { label: "My Profile",     href: "/student/profile",        icon: User,          emoji: "👤", startsWith: ["/student/profile"] },
  { label: "Course Search",  href: "/student/courses",        icon: Search,        emoji: "🔍", startsWith: ["/student/courses"] },
  { label: "My Wishlist",    href: "/student/wishlist",       icon: Heart,         emoji: "❤️", startsWith: ["/student/wishlist"] },
  { label: "Applications",   href: "/student/applications",   icon: FileText,      emoji: "📋", startsWith: ["/student/applications"] },
  { label: "Documents",      href: "/student/documents",      icon: Folder,        emoji: "📁", startsWith: ["/student/documents"] },
  { label: "My CV",          href: "/student/cv-builder",     icon: FileText,      emoji: "📄", startsWith: ["/student/cv-builder"] },
  { label: "Finance",        href: "/student/finance",        icon: Coins,         emoji: "💳", startsWith: ["/student/finance"] },
  { label: "Scholarships",   href: "/student/scholarships",   icon: Star,          emoji: "🏆", startsWith: ["/student/scholarships"] },
  { label: "Mock Interview",  href: "/student/mock-interview", icon: Mic,           emoji: "🎤", startsWith: ["/student/mock-interview"] },
  { label: "Messages",       href: "/student/messages",       icon: MessageCircle, emoji: "💬", startsWith: ["/student/messages"] },
  { label: "Notifications",  href: "/student/notifications",  icon: Bell,          emoji: "🔔", startsWith: ["/student/notifications"] },
];

const PAGE_TITLES: Array<{ match: string; title: string }> = [
  { match: "/student/dashboard",      title: "Student Dashboard" },
  { match: "/student/profile",        title: "My Profile" },
  { match: "/student/courses",        title: "Course Search" },
  { match: "/student/wishlist",       title: "My Wishlist" },
  { match: "/student/applications",   title: "My Applications" },
  { match: "/student/documents",      title: "Documents" },
  { match: "/student/cv-builder",     title: "My CV" },
  { match: "/student/finance",        title: "Finance" },
  { match: "/student/scholarships",   title: "Scholarships" },
  { match: "/student/mock-interview", title: "Mock Interview" },
  { match: "/student/messages",       title: "Messages" },
  { match: "/student/notifications",  title: "Notifications" },
  { match: "/student/settings",       title: "Settings" },
];

function getPageTitle(pathname: string) {
  return PAGE_TITLES.find((p) => pathname.startsWith(p.match))?.title ?? "Student Portal";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function ProfileCompletion({ pct }: { pct: number }) {
  const color = pct === 100 ? "#10b981" : pct >= 70 ? "#F5A623" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/40 font-medium">Profile {pct}%</span>
        {pct === 100 && <span className="text-[10px] text-emerald-400 font-semibold">Complete ✓</span>}
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
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

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

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
      <div
        className="flex h-full flex-col"
        style={{ background: "linear-gradient(190deg, #0d1f3c 0%, #162643 40%, #1B2A4A 100%)" }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3 mb-5">
            {/* Logo mark: navy square with gold E */}
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black shadow-lg"
              style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
            >
              <GraduationCap className="h-5 w-5 text-[#1B2A4A]" />
            </div>
            <div>
              <p className="text-sm font-black text-white tracking-tight">EduQuantica</p>
              <p className="text-[10px] text-white/40 -mt-0.5 font-medium tracking-wide">Student Portal</p>
            </div>
          </div>

          {/* Profile card */}
          <Link
            href="/student/profile"
            className="block rounded-xl p-3 transition-all"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-xs font-black text-[#1B2A4A] shadow"
                style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
              >
                {initials(studentName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white leading-tight">{studentName}</p>
                <p className="truncate text-[11px] text-white/38">{studentEmail}</p>
              </div>
            </div>
            <ProfileCompletion pct={profileCompletion} />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/25">Menu</p>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "text-[#F5A623]"
                    : "text-white/55 hover:bg-white/07 hover:text-white/90",
                )}
                style={active ? {
                  background: "rgba(245, 166, 35, 0.12)",
                  borderLeft: "2px solid #F5A623",
                  paddingLeft: "calc(0.75rem - 2px)",
                } : {}}
              >
                <span className="text-base leading-none w-5 text-center flex-shrink-0">{item.emoji}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {active && <div className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-5 pt-2 border-t border-white/8">
          <Link
            href="/student/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/45 hover:bg-white/07 hover:text-white/85 transition-all"
          >
            <Settings className="h-4 w-4 ml-0.5 flex-shrink-0" />
            <span>Settings</span>
          </Link>
          <button
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="mt-0.5 w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/35 hover:bg-red-500/12 hover:text-red-300 transition-all"
          >
            <LogOut className="h-4 w-4 ml-0.5 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f4f7fd" }}>
      <div className="flex min-h-screen">

        {/* Desktop sidebar — flush to edge */}
        <aside className="hidden w-60 shrink-0 lg:block">
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
            <div className="absolute left-0 top-0 bottom-0 w-64 overflow-hidden shadow-2xl">
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

        {/* Main content — fully flush, no left gap */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Topbar */}
          <header
            className="sticky top-0 z-30 border-b"
            style={{ borderColor: "rgba(27,42,74,0.1)", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <div className="flex h-14 items-center justify-between gap-3 px-5 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border text-slate-600 lg:hidden hover:bg-slate-50 transition"
                  style={{ borderColor: "rgba(27,42,74,0.15)" }}
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <h1 className="truncate text-base font-bold text-[#1B2A4A]">{pageTitle}</h1>
              </div>

              <div className="flex items-center gap-2">
                <NotificationsBell />

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex h-9 items-center gap-2 rounded-xl border px-2 hover:bg-slate-50 transition"
                    style={{ borderColor: "rgba(27,42,74,0.14)" }}
                  >
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black text-[#1B2A4A]"
                      style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
                    >
                      {initials(studentName)}
                    </span>
                    <span className="hidden max-w-[100px] truncate text-sm font-semibold text-slate-700 sm:block">
                      {studentName.split(" ")[0]}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border bg-white shadow-xl" style={{ borderColor: "rgba(27,42,74,0.1)" }}>
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-900">{studentName}</p>
                        <p className="text-xs text-slate-400 truncate">{studentEmail}</p>
                      </div>
                      <div className="py-1">
                        <Link href="/student/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition">
                          <User className="h-3.5 w-3.5 text-[#1B2A4A]" /> My Profile
                        </Link>
                        <Link href="/student/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition">
                          <Settings className="h-3.5 w-3.5 text-[#1B2A4A]" /> Settings
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
              <div
                className="border-t px-5 py-2.5 sm:px-7"
                style={{ borderColor: "rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.07)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[#1B2A4A]">
                    ✨ Profile is <strong>{profileCompletion}%</strong> — complete it to unlock personalised course matches.
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={firstIncompleteHref}
                      className="inline-flex h-8 items-center rounded-xl px-4 text-xs font-bold text-[#1B2A4A] hover:opacity-90 transition shadow-sm"
                      style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
                    >
                      Finish Profile →
                    </Link>
                    <button
                      onClick={dismissBannerFor24h}
                      className="inline-flex h-8 items-center rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition"
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* Page content — no outer padding, pages are flush */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      <StudentFloatingChatButton unreadCount={unreadEduviCount} />
    </div>
  );
}
