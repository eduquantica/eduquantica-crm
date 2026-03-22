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
  startsWith?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/student/dashboard", icon: Home, startsWith: ["/student/dashboard", "/student"] },
  { label: "My Profile", href: "/student/profile", icon: User, startsWith: ["/student/profile"] },
  { label: "Course Search", href: "/student/courses", icon: Search, startsWith: ["/student/courses"] },
  { label: "My Wishlist", href: "/student/wishlist", icon: Heart, startsWith: ["/student/wishlist"] },
  { label: "My Applications", href: "/student/applications", icon: FileText, startsWith: ["/student/applications"] },
  { label: "Documents", href: "/student/documents", icon: Folder, startsWith: ["/student/documents"] },
  { label: "My CV", href: "/student/cv-builder", icon: FileText, startsWith: ["/student/cv-builder"] },
  { label: "Finance", href: "/student/finance", icon: Coins, startsWith: ["/student/finance"] },
  { label: "Scholarships", href: "/student/scholarships", icon: Star, startsWith: ["/student/scholarships"] },
  { label: "Messages", href: "/student/messages", icon: MessageCircle, startsWith: ["/student/messages"] },
  { label: "Notifications", href: "/student/notifications", icon: Bell, startsWith: ["/student/notifications"] },
];

function pageTitle(pathname: string): string {
  const map: Array<{ match: string; title: string }> = [
    { match: "/student/dashboard", title: "Student Dashboard" },
    { match: "/student/profile", title: "My Profile" },
    { match: "/student/courses", title: "Course Search" },
    { match: "/student/wishlist", title: "My Wishlist" },
    { match: "/student/applications", title: "My Applications" },
    { match: "/student/documents", title: "Documents" },
    { match: "/student/finance", title: "Finance" },
    { match: "/student/scholarships", title: "Scholarships" },
    { match: "/student/messages", title: "Messages" },
    { match: "/student/notifications", title: "Notifications" },
    { match: "/student/settings", title: "Settings" },
  ];

  const found = map.find((item) => pathname.startsWith(item.match));
  if (found) return found.title;
  return "Student Portal";
}

function completionBarClass(percentage: number): string {
  if (percentage === 100) return "bg-emerald-500";
  if (percentage >= 70) return "bg-blue-500";
  if (percentage >= 40) return "bg-amber-400";
  return "bg-red-500";
}

function initials(name: string): string {
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
    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(dismissKey);
    const hiddenUntil = raw ? Number(raw) : 0;
    const now = Date.now();
    if (profileCompletion < 70 && hiddenUntil <= now) {
      setBannerVisible(true);
    } else {
      setBannerVisible(false);
    }
  }, [dismissKey, profileCompletion]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const title = useMemo(() => pageTitle(pathname), [pathname]);

  function isActive(item: NavItem) {
    const patterns = item.startsWith || [item.href];
    return patterns.some((pattern) => pathname === pattern || pathname.startsWith(pattern));
  }

  function dismissBannerFor24h() {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    window.localStorage.setItem(dismissKey, String(until));
    setBannerVisible(false);
  }

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">EduQuantica</p>
          <p className="mt-1 text-lg font-bold text-[#1E3A5F]">Student Portal</p>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profile Completion</p>
              <p className="text-xs font-semibold text-slate-700">{profileCompletion}%</p>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn("h-full rounded-full transition-all", completionBarClass(profileCompletion))}
                style={{ width: `${Math.max(0, Math.min(100, profileCompletion))}%` }}
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                  active
                    ? "bg-[#1E3A5F] text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-[#1E3A5F]",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <Link href="/student/profile" className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">My Progress</p>
              <p className="text-xs font-semibold text-slate-700">{profileCompletion}%</p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn("h-full rounded-full transition-all", completionBarClass(profileCompletion))}
                style={{ width: `${Math.max(0, Math.min(100, profileCompletion))}%` }}
              />
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-200 lg:block">
          <SidebarContent />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Close navigation drawer"
            />
            <div className="absolute inset-0 w-full bg-white">
              <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
                <p className="text-base font-semibold text-[#1E3A5F]">Menu</p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="truncate text-lg font-semibold text-[#1E3A5F]">{title}</h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationsBell />

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-2.5 hover:bg-slate-50"
                    aria-label="Open account menu"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-semibold text-white">
                      {initials(studentName)}
                    </span>
                    <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-700 sm:block">
                      {studentName}
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="border-b border-slate-100 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{studentName}</p>
                        <p className="text-xs text-slate-500">{studentEmail}</p>
                      </div>
                      <Link
                        href="/student/profile"
                        className="flex h-11 items-center px-3 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/student/settings"
                        className="flex h-11 items-center px-3 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <div className="border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => void signOut({ callbackUrl: "/login" })}
                        className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm text-red-500 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {profileCompletion < 70 && bannerVisible && (
              <div className="border-t border-blue-100 bg-blue-50 px-4 py-3 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-blue-900">
                    Your profile is <strong>{profileCompletion}%</strong> complete. Complete your profile to unlock course recommendations.
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={firstIncompleteHref}
                      className="inline-flex h-11 items-center rounded-lg bg-[#1E3A5F] px-4 text-sm font-semibold text-white hover:opacity-95"
                    >
                      Complete Now
                    </Link>
                    <button
                      type="button"
                      onClick={dismissBannerFor24h}
                      className="inline-flex h-11 items-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Dismiss
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
