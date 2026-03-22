"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import ThemeToggle from "@/components/student/ThemeToggle";
import NotificationsBell from "@/components/ui/NotificationsBell";

function getInitials(name: string, email?: string | null) {
  const cleaned = name.trim();
  if (!cleaned) return (email || "U").slice(0, 1).toUpperCase();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function StudentNavbar() {
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
    <header className="h-16 border-b border-white/50 bg-white/80 px-6 flex items-center justify-between backdrop-blur-xl transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/80">
      <h1 className="text-lg font-semibold text-[#1B2A4A] dark:text-slate-100">Student Dashboard</h1>

      <div className="flex items-center gap-2">
        <div className="rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/60">
          <NotificationsBell />
        </div>
        <ThemeToggle />
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-2.5 transition-all duration-200 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          aria-label="Open account menu"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-700 sm:block dark:text-slate-200">{userName}</span>
          <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-300" />
        </button>

        {open && (
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-white/40 bg-white/80 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{userName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700" />

            <Link
              href="/student/profile"
              className="flex h-11 items-center gap-2 px-3 text-sm text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              <User className="h-4 w-4" />
              My Profile
            </Link>
            <Link
              href="/student/settings"
              className="flex h-11 items-center gap-2 px-3 text-sm text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>

            <div className="border-t border-slate-100 dark:border-slate-700" />

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
    </header>
  );
}
