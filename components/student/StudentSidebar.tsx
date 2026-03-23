"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Cog, Home, LogOut, MessageCircle, Wallet, Bell, FileText, Folder, Heart, Search, User, GraduationCap, Sparkles, CreditCard } from "lucide-react"

const links = [
  { href: "/student/dashboard", label: "Home", icon: Home },
  { href: "/student/profile", label: "My Profile", icon: User },
  { href: "/student/courses", label: "Course Search", icon: Search },
  { href: "/student/services", label: "Services", icon: Home },
  { href: "/student/wishlist", label: "My Wishlist", icon: Heart },
  { href: "/student/applications", label: "My Applications", icon: FileText },
  { href: "/student/documents", label: "Documents", icon: Folder },
  { href: "/student/cv-builder", label: "My CV", icon: GraduationCap },
  { href: "/student/write-sop", label: "Write SOP", icon: Sparkles },
  { href: "/student/finance", label: "Finance", icon: Wallet },
  { href: "/student/payments", label: "Payments", icon: CreditCard },
  { href: "/student/messages", label: "Messages", icon: MessageCircle },
  { href: "/student/mock-interview", label: "Mock Interview", icon: GraduationCap },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
]

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || "").trim()
  if (!source) return (email || "ST").slice(0, 2).toUpperCase()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function StudentSidebar() {
  const pathname = usePathname()
  const { data } = useSession()

  const userName = data?.user?.name || "Student"
  const userEmail = data?.user?.email || ""
  const initials = getInitials(userName, userEmail)

  return (
    <aside className="flex flex-col h-screen w-[260px] text-white flex-shrink-0 overflow-y-auto bg-gradient-to-br from-[#1B2A4A] to-[#2d4a7a] dark:from-[#0f172a] dark:to-[#1e293b]">
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-lg font-bold tracking-tight text-white drop-shadow-[0_0_14px_rgba(245,166,35,0.35)]">EduQuantica</p>
        <p className="text-xs text-[#F5A623] font-semibold tracking-wide">Student Portal</p>
      </div>

      <nav className="flex flex-col gap-1.5 px-3 py-4">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                active
                  ? "border-l-[3px] border-l-[#F5A623] bg-white/15 text-white backdrop-blur"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 p-4">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-white/70">STUDENT</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/student/settings"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/20 px-2 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              <Cog className="h-4 w-4" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center justify-center rounded-lg border border-red-300/40 px-3 py-2 text-red-100 hover:bg-red-500/20"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
