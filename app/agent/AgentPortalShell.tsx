"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import AgentSidebar from "./AgentSidebar";
import DashboardNavbar from "../dashboard/DashboardNavbar";

const AGENT_PAGE_TITLES: Record<string, string> = {
  "/agent/dashboard": "Agent Dashboard",
  "/agent/leads": "Leads",
  "/agent/students": "My Students",
  "/agent/training": "Training",
  "/agent/kpi": "KPI Management",
  "/agent/applications": "Applications",
  "/agent/commissions": "Commissions",
  "/agent/reports": "Reports",
  "/agent/certificate": "Partner Certificate",
  "/agent/white-label": "White Label",
  "/agent/messages": "Messages",
  "/agent/notifications": "Notifications",
  "/agent/settings": "Settings",
  "/agent/team": "My Team",
};

function getPageTitle(pathname: string): string {
  if (AGENT_PAGE_TITLES[pathname]) return AGENT_PAGE_TITLES[pathname];
  const sorted = Object.keys(AGENT_PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(`${key}/`)) return AGENT_PAGE_TITLES[key];
  }
  return "Agent Portal";
}

type AgentPortalShellProps = {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    avatar: string | null;
    isBranchCounsellor?: boolean;
  };
};

const COLLAPSE_STORAGE_KEY = "agent_sidebar_collapsed";

export default function AgentPortalShell({ children, user }: AgentPortalShellProps) {
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

      <AgentSidebar
        isCollapsed={collapsed}
        isMobileOpen={mobileOpen}
        onCollapse={() => setCollapsed((value) => !value)}
        onMobileClose={() => setMobileOpen(false)}
        isBranchCounsellor={user.isBranchCounsellor}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardNavbar
          pageTitle={pageTitle}
          user={{ name: user.name, email: user.email, avatar: user.avatar }}
          onOpenMobileMenu={() => setMobileOpen(true)}
          profileHref="/agent/settings/profile"
          settingsHref="/agent/settings"
        />
        <main className="flex-1 overflow-y-auto bg-[#F8F9FC] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
