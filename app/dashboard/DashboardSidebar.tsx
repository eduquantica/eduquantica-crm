"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileText,
  Building2,
  BookOpen,
  Handshake,
  MessageSquare,
  CheckSquare,
  Award,
  Coins,
  Shield,
  ShieldCheck,
  BarChart2,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { usePermission } from "@/lib/permissions";
import { useSession } from "next-auth/react";
import BrandLogo from "@/components/ui/BrandLogo";
// ─── Nav item definitions ──────────────────────────────────────────────────────

interface NavItemDef {
  label: string;
  href: string;
  icon: React.ElementType;
  matchPrefix?: string;
  /** If set, item is hidden when user lacks canView for this module */
  permModule?: string;
  allowedRoles?: string[];
  /** Show the pending-applications badge on this item */
  hasBadge?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Leads",
    href: "/dashboard/leads",
    icon: Users,
    matchPrefix: "/dashboard/leads",
    permModule: "leads",
  },
  {
    label: "Students",
    href: "/dashboard/students",
    icon: GraduationCap,
    matchPrefix: "/dashboard/students",
    permModule: "students",
  },
  {
    label: "Applications",
    href: "/dashboard/applications",
    icon: FileText,
    matchPrefix: "/dashboard/applications",
    permModule: "applications",
  },
  {
    label: "Universities",
    href: "/dashboard/universities",
    icon: Building2,
    matchPrefix: "/dashboard/universities",
    permModule: "universities",
  },
  {
    label: "Courses",
    href: "/dashboard/courses",
    icon: BookOpen,
    matchPrefix: "/dashboard/courses",
    permModule: "courses",
  },
  {
    label: "Sub-Agents",
    href: "/dashboard/sub-agents",
    icon: Handshake,
    matchPrefix: "/dashboard/sub-agents",
    permModule: "sub-agents",
    hasBadge: true,
  },
  {
    label: "White Label",
    href: "/dashboard/white-label",
    icon: BookOpen,
    matchPrefix: "/dashboard/white-label",
    permModule: "sub-agents",
  },
  {
    label: "Communications",
    href: "/dashboard/communications",
    icon: MessageSquare,
    matchPrefix: "/dashboard/communications",
    permModule: "communications",
  },
  {
    label: "Templates",
    href: "/dashboard/communications/templates",
    icon: FileText,
    matchPrefix: "/dashboard/communications/templates",
    permModule: "communications",
  },
  {
    label: "Bulk Email",
    href: "/dashboard/communications/bulk-email",
    icon: MessageSquare,
    matchPrefix: "/dashboard/communications/bulk-email",
    permModule: "communications",
  },
  {
    label: "Tasks",
    href: "/dashboard/tasks",
    icon: CheckSquare,
    matchPrefix: "/dashboard/tasks",
    permModule: "tasks",
  },
  {
    label: "Training",
    href: "/dashboard/training",
    icon: Award,
    matchPrefix: "/dashboard/training",
  },
  {
    label: "Commissions",
    href: "/dashboard/commissions",
    icon: Coins,
    matchPrefix: "/dashboard/commissions",
    permModule: "commissions",
  },
  {
    label: "Visa Tracking",
    href: "/dashboard/visa",
    icon: Shield,
    matchPrefix: "/dashboard/visa",
    permModule: "visa",
  },
  {
    label: "Student Services",
    href: "/dashboard/student-services",
    icon: CheckSquare,
    matchPrefix: "/dashboard/student-services",
  },
  {
    label: "Document Verification",
    href: "/dashboard/document-verification",
    icon: ShieldCheck,
    matchPrefix: "/dashboard/document-verification",
    permModule: "documents",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: BarChart2,
    matchPrefix: "/dashboard/reports",
    permModule: "reports",
  },
  {
    label: "My CV",
    href: "/dashboard/cv-builder",
    icon: FileText,
    matchPrefix: "/dashboard/cv-builder",
  },
  {
    label: "KPI Management",
    href: "/dashboard/kpi",
    icon: Target,
    matchPrefix: "/dashboard/kpi",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Living Costs",
    href: "/dashboard/living-costs",
    icon: Coins,
    matchPrefix: "/dashboard/living-costs",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    matchPrefix: "/dashboard/settings",
    permModule: "settings",
  },
];

// ─── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  collapsed,
  badge,
}: {
  item: NavItemDef;
  isActive: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  // Always call hooks before any conditional return
  const hasPermission = usePermission(item.permModule ?? "", "canView");
  const { data: session } = useSession();
  const roleName = session?.user?.roleName;
  if (item.permModule && !hasPermission) return null;
  if (item.allowedRoles && (!roleName || !item.allowedRoles.includes(roleName))) return null;

  const Icon = item.icon;
  const showBadge = badge !== undefined && badge > 0;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group border-l-4",
        collapsed && "justify-center px-2",
        isActive
          ? "text-[#F5A623] bg-white/10 border-[#F5A623]"
          : "text-white/90 hover:bg-white/10 hover:text-white border-transparent",
      )}
    >
      {/* Icon with dot badge in collapsed mode */}
      <span className="relative shrink-0">
        <Icon className="w-4 h-4" />
        {collapsed && showBadge && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white/20" />
        )}
      </span>

      {/* Label + pill badge (expanded only) */}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {showBadge && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
              {badge! > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}

      {/* Tooltip (collapsed mode hover) */}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-150 shadow-lg">
          {item.label}
          {showBadge && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
              {badge! > 99 ? "99+" : badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar nav list ──────────────────────────────────────────────────────────

function SidebarNav({
  pathname,
  pendingCount,
  taskBadgeCount,
  collapsed,
}: {
  pathname: string;
  pendingCount: number;
  taskBadgeCount: number;
  collapsed: boolean;
}) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const isActive = item.matchPrefix
          ? pathname.startsWith(item.matchPrefix)
          : pathname === item.href;
        let badge: number | undefined;
        if (item.href === "/dashboard/tasks") {
          badge = taskBadgeCount;
        } else if (item.hasBadge) {
          badge = pendingCount;
        }
        return (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive}
            collapsed={collapsed}
            badge={badge}
          />
        );
      })}
    </nav>
  );
}

// ─── Sidebar component ─────────────────────────────────────────────────────────

interface SidebarProps {
  pendingCount: number;
  taskBadgeCount: number;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCollapse: () => void;
  onMobileClose: () => void;
}

export default function DashboardSidebar({
  pendingCount,
  taskBadgeCount,
  isCollapsed,
  isMobileOpen,
  onCollapse,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 transition-all duration-300 overflow-hidden",
          isCollapsed ? "w-[72px]" : "w-[260px]",
        )}
        style={{ backgroundColor: "#1B2A4A" }}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center shrink-0 border-b py-4 transition-all duration-300",
            isCollapsed ? "justify-center px-3" : "px-5",
          )}
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          {isCollapsed ? (
            <div className="h-9 w-9 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
              E
            </div>
          ) : (
            <div>
              <BrandLogo variant="white" width={170} />
              <p className="text-xs mt-0.5" style={{ color: "rgba(191,219,254,0.7)" }}>
                Admin Dashboard
              </p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <SidebarNav pathname={pathname} pendingCount={pendingCount} taskBadgeCount={taskBadgeCount} collapsed={isCollapsed} />

        {/* Collapse toggle */}
        <div
          className="px-3 py-3 shrink-0 border-t"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <button
            onClick={onCollapse}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
              isCollapsed && "justify-center",
            )}
            style={{ color: "rgba(191,219,254,0.8)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.1)";
              (e.currentTarget as HTMLElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "";
              (e.currentTarget as HTMLElement).style.color = "rgba(191,219,254,0.8)";
            }}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile sidebar drawer ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col lg:hidden transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: "#1B2A4A" }}
      >
        {/* Logo + close button */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <BrandLogo variant="white" width={150} />
          <button
            onClick={onMobileClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: "rgba(191,219,254,0.8)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.1)";
              (e.currentTarget as HTMLElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "";
              (e.currentTarget as HTMLElement).style.color = "rgba(191,219,254,0.8)";
            }}
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <SidebarNav pathname={pathname} pendingCount={pendingCount} taskBadgeCount={taskBadgeCount} collapsed={false} />
      </aside>
    </>
  );
}
