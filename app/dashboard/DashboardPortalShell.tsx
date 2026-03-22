"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import DashboardSidebar from "./DashboardSidebar";
import DashboardNavbar from "./DashboardNavbar";

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
  "/dashboard/training": "Training",
  "/dashboard/commissions": "Commissions",
  "/dashboard/visa": "Visa Tracking",
  "/dashboard/documents": "Document Verification",
  "/dashboard/reports": "Reports",
  "/dashboard/kpi": "KPI Management",
  "/dashboard/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(`${key}/`)) return PAGE_TITLES[key];
  }
  return "Dashboard";
}

type DashboardPortalShellProps = {
  pendingCount: number;
  overdueCount: number;
  user: {
    name: string | null;
    email: string;
    avatar: string | null;
  };
  children: React.ReactNode;
};

const COLLAPSE_STORAGE_KEY = "dashboard_sidebar_collapsed";

export default function DashboardPortalShell({ pendingCount, overdueCount, user, children }: DashboardPortalShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    setCollapsed(raw === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation drawer"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
        />
      )}

      <DashboardSidebar
        pendingCount={pendingCount}
        taskBadgeCount={overdueCount}
        isCollapsed={collapsed}
        isMobileOpen={mobileOpen}
        onCollapse={() => setCollapsed((value) => !value)}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardNavbar
          pageTitle={pageTitle}
          user={user}
          onOpenMobileMenu={() => setMobileOpen(true)}
          profileHref="/dashboard/settings/profile"
          settingsHref="/dashboard/settings"
        />
        <main className="flex-1 overflow-y-auto bg-[#F8F9FC] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
