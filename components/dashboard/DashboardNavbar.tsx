"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import ThemeToggle from "@/components/student/ThemeToggle";

function getInitials(name: string, email?: string | null) {
  const cleaned = name.trim();
  if (!cleaned) return (email || "U").slice(0, 1).toUpperCase();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function DashboardNavbar() {
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const userName = data?.user?.name || "User";
  const userEmail = data?.user?.email || "";
  const initials = getInitials(userName, userEmail);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <header className="portal-topbar flex h-16 items-center justify-between px-4 md:px-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--eq-ink)]">Dashboard</h1>
        <p className="hidden text-xs text-[var(--eq-ink-soft)] sm:block">Staff command center</p>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle />
        <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="portal-shell-card flex h-11 items-center gap-2 px-2.5"
          aria-label="Open account menu"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1B2A4A] to-[#2f4f86] text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-[var(--eq-ink-soft)] sm:block">{userName}</span>
          <ChevronDown className="h-4 w-4 text-[var(--eq-ink-soft)]" />
        </button>

        {open && (
          <div className="portal-shell-card absolute right-0 z-40 mt-2 w-56 overflow-hidden">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-[var(--eq-ink)]">{userName}</p>
              <p className="truncate text-xs text-[var(--eq-ink-soft)]">{userEmail}</p>
            </div>
            <div className="border-t border-[var(--eq-border)]" />

            <Link
              href="/dashboard/settings/profile"
              className="flex h-11 items-center gap-2 px-3 text-sm text-[var(--eq-ink-soft)] hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
              onClick={() => setOpen(false)}
            >
              <User className="h-4 w-4" />
              My Profile
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex h-11 items-center gap-2 px-3 text-sm text-[var(--eq-ink-soft)] hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>

            <div className="border-t border-[var(--eq-border)]" />

            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
