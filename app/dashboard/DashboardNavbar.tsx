"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Menu, Settings, User } from "lucide-react";
import NotificationsBell from "@/components/ui/NotificationsBell";
import GlobalSearch from "@/components/GlobalSearch";

interface DashboardNavbarProps {
  pageTitle: string;
  user: {
    name: string | null;
    email: string;
    avatar: string | null;
  };
  onOpenMobileMenu: () => void;
  profileHref: string;
  settingsHref: string;
}

export default function DashboardNavbar({
  pageTitle,
  user,
  onOpenMobileMenu,
  profileHref,
  settingsHref,
}: DashboardNavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 1).toUpperCase();

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-4">
      <div className="flex h-full items-center gap-3">
        <button
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="max-w-[220px] truncate text-sm font-semibold text-slate-800 lg:max-w-none lg:text-base">
          {pageTitle}
        </h1>

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <NotificationsBell />

        <div className="relative ml-1">
          <button
            onClick={() => setDropdownOpen((value) => !value)}
            className="flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-slate-100"
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
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1B2A4A] text-xs font-semibold text-white">
                {initials}
              </span>
            )}
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-800">{user.name ?? "User"}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>

                <div className="py-1">
                  <Link
                    href={profileHref}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-[#FFF6E8]"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    My Profile
                  </Link>
                  <Link
                    href={settingsHref}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-[#FFF6E8]"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Settings
                  </Link>
                </div>

                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
