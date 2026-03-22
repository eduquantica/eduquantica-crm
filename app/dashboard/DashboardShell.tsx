"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Menu, ChevronDown, LogOut, User, Settings } from "lucide-react";
import Image from "next/image";
import DashboardSidebar from "./DashboardSidebar";
import NotificationsBell from "@/components/ui/NotificationsBell";
import GlobalSearch from "@/components/GlobalSearch";
import BrandLogo from "@/components/ui/BrandLogo";

// ─── Page title map ────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/leads": "Leads",
  "/dashboard/students": "Students",
  "/dashboard/applications": "Applications",
  "/dashboard/universities": "Universities",
  "/dashboard/courses": "Courses",
  "/dashboard/sub-agents": "Sub-Agents",
  "/dashboard/sub-agents/applications": "Sub-Agent Applications",
  "/dashboard/communications": "Communications",
  "/dashboard/tasks": "Tasks",
  "/dashboard/commissions": "Commissions",
  "/dashboard/visa": "Visa Tracking",
  "/dashboard/documents": "Document Verification",
  "/dashboard/reports": "Reports",
    "/dashboard/kpi": "KPI Management",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/users": "Staff Accounts",
  "/dashboard/settings/roles": "Roles & Permissions",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Longest-prefix match for dynamic routes (e.g. /dashboard/students/[id])
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(key + "/")) return PAGE_TITLES[key];
  }
  return "Dashboard";
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ShellProps {
  pendingCount: number; // sub-agent pending applications
  overdueCount: number; // overdue tasks count
  user: {
    name: string | null;
    email: string;
    avatar: string | null;
    roleName: string;
  };
  children: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DashboardShell({ pendingCount, overdueCount, user, children }: ShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const pageTitle = getPageTitle(pathname);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <div className="flex h-screen bg-[#F8F9FC] overflow-hidden">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar
        pendingCount={pendingCount}
        taskBadgeCount={overdueCount}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCollapse={() => setIsCollapsed((v) => !v)}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Top navigation bar ──────────────────────────────────────────────── */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 gap-3 z-10">
          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:block">
            <BrandLogo width={140} />
          </div>

          {/* Global search */}
          <GlobalSearch />

          {/* Page title — centred */}
          <h1 className="flex-1 text-center text-sm font-semibold text-slate-800 lg:text-base truncate">
            {pageTitle}
          </h1>

          {/* Right-side actions */}
          <div className="flex items-center gap-1">
            {/* Notifications */}
            <NotificationsBell />

            {/* Avatar dropdown */}
            <div className="relative ml-1">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="User menu"
              >
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name ?? "User"}
                    width={28}
                    height={28}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-xs font-semibold select-none">
                    {initials}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {dropdownOpen && (
                <>
                  {/* Click-away layer */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  {/* Dropdown panel */}
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-52 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    {/* User info */}
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {user.name ?? "User"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>

                    {/* Links */}
                    <div className="py-1">
                      <Link
                        href="/dashboard/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-[#FFF6E8] transition-colors"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        My Profile
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-[#FFF6E8] transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        Settings
                      </Link>
                    </div>

                    <div className="border-t border-slate-100 py-1">
                      <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
