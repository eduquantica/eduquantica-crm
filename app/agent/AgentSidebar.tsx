"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  Bell,
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  MessageSquare,
  Settings,
  Users,
  Wallet,
  X,
  Award,
} from "lucide-react";

type AgentSidebarProps = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCollapse: () => void;
  onMobileClose: () => void;
  isBranchCounsellor?: boolean;
};

type AgentNavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  hideForBranchCounsellor?: boolean;
};

const NAV_ITEMS: AgentNavItem[] = [
  { label: "Dashboard", href: "/agent/dashboard", icon: Home },
  { label: "Leads", href: "/agent/leads", icon: Users },
  { label: "My Students", href: "/agent/students", icon: Users },
  { label: "My Team", href: "/agent/team", icon: Users, hideForBranchCounsellor: true },
  { label: "Training", href: "/agent/training", icon: BookOpen },
  { label: "KPI Management", href: "/agent/kpi", icon: BookOpen, hideForBranchCounsellor: true },
  { label: "Applications", href: "/agent/applications", icon: FileText },
  { label: "Commissions", href: "/agent/commissions", icon: Wallet },
  { label: "My CV", href: "/agent/cv-builder", icon: FileText },
  { label: "Reports", href: "/agent/reports", icon: BarChart2 },
  { label: "Certificate", href: "/agent/certificate", icon: Award, hideForBranchCounsellor: true },
  { label: "White Label", href: "/agent/white-label", icon: BookOpen },
  { label: "Messages", href: "/agent/messages", icon: MessageSquare },
  { label: "Notifications", href: "/agent/notifications", icon: Bell },
  { label: "Settings", href: "/agent/settings", icon: Settings },
];

function SidebarLinks({
  pathname,
  isCollapsed,
  isBranchCounsellor,
  onNavigate,
}: {
  pathname: string;
  isCollapsed: boolean;
  isBranchCounsellor?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        if (isBranchCounsellor && item.hideForBranchCounsellor) {
          return null;
        }

        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-sm font-medium transition-all",
              isCollapsed && "justify-center px-2",
              active
                ? "border-[#F5A623] bg-white/10 text-[#F5A623]"
                : "border-transparent text-white/90 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="truncate">{item.label}</span>}

            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AgentSidebar({
  isCollapsed,
  isMobileOpen,
  onCollapse,
  onMobileClose,
  isBranchCounsellor,
}: AgentSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden bg-[#1B2A4A] transition-all duration-300 lg:flex",
          isCollapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        <div className={cn("shrink-0 border-b border-white/10 py-4", isCollapsed ? "px-3" : "px-5")}>
          {isCollapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 font-bold text-white">E</div>
          ) : (
            <>
              <p className="text-lg font-bold text-white">EduQuantica</p>
              <p className="text-xs text-blue-100/80">Sub-Agent Portal</p>
            </>
          )}
        </div>

        <SidebarLinks pathname={pathname} isCollapsed={isCollapsed} isBranchCounsellor={isBranchCounsellor} />

        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <button
            onClick={onCollapse}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100/80 transition-colors hover:bg-white/10 hover:text-white",
              isCollapsed && "justify-center",
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-[#1B2A4A] transition-transform duration-300 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-lg font-bold text-white">EduQuantica</p>
            <p className="text-xs text-blue-100/80">Sub-Agent Portal</p>
          </div>
          <button
            onClick={onMobileClose}
            className="rounded-md p-1 text-blue-100/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <SidebarLinks
          pathname={pathname}
          isCollapsed={false}
          isBranchCounsellor={isBranchCounsellor}
          onNavigate={onMobileClose}
        />
      </aside>
    </>
  );
}
