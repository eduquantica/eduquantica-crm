"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/students", label: "Students" },
  { href: "/dashboard/applications", label: "Applications" },
  { href: "/dashboard/universities", label: "Universities" },
  { href: "/dashboard/courses", label: "Courses" },
  { href: "/dashboard/sub-agents", label: "Sub-Agents" },
  { href: "/dashboard/communications", label: "Communications" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/training", label: "Training" },
  { href: "/dashboard/commissions", label: "Commissions" },
  { href: "/dashboard/pl", label: "Profit & Loss" },
  { href: "/dashboard/visa", label: "Visa Tracking" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/cv-builder", label: "My CV" },
  { href: "/dashboard/settings", label: "Settings" },
]

export default function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="portal-sidebar flex h-screen w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-white/10">
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-lg font-bold tracking-wide text-white">EduQuantica</p>
        <p className="text-xs text-white/75">Staff Portal</p>
      </div>
      <nav className="flex flex-col gap-1 px-3 py-4">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`portal-nav-item ${active ? "portal-nav-item-active" : ""}`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
