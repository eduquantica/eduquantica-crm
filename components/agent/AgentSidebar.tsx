"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/agent/dashboard", label: "Dashboard" },
  { href: "/agent/leads", label: "Leads" },
  { href: "/agent/students", label: "My Students" },
  { href: "/agent/applications", label: "Applications" },
  { href: "/agent/commissions", label: "Commissions" },
  { href: "/agent/pl", label: "Profit & Loss" },
  { href: "/agent/cv-builder", label: "My CV" },
  { href: "/agent/messages", label: "Messages" },
  { href: "/agent/notifications", label: "Notifications" },
  { href: "/agent/settings", label: "Settings" },
]

export default function AgentSidebar() {
  const pathname = usePathname()

  return (
    <aside className="portal-sidebar flex h-screen w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-white/10">
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-lg font-bold tracking-wide text-white">EduQuantica</p>
        <p className="text-xs text-white/75">Agent Portal</p>
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
