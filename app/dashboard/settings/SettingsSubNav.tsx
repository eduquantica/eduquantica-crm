"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { label: "Staff Accounts", href: "/dashboard/settings/users" },
  { label: "Roles & Permissions", href: "/dashboard/settings/roles" },
  { label: "API & Integrations", href: "/dashboard/settings/api" },
];

export default function SettingsSubNav() {
  const pathname = usePathname();
  return (
    <div className="flex border-b border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            pathname.startsWith(tab.href)
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
