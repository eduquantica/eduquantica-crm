"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CircleDollarSign, FileText, Settings, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  category: "APPLICATIONS" | "DOCUMENTS" | "COMMISSIONS" | "SYSTEM";
  createdAt: string;
};

type NotificationsPayload = {
  data: NotificationItem[];
  unreadCount: number;
  unreadImmigrationCount?: number;
};

function iconForCategory(category: NotificationItem["category"]) {
  if (category === "APPLICATIONS") return BellRing;
  if (category === "DOCUMENTS") return FileText;
  if (category === "COMMISSIONS") return CircleDollarSign;
  return Settings;
}

function iconColoursForCategory(category: NotificationItem["category"]) {
  if (category === "APPLICATIONS") {
    return "text-blue-600 bg-blue-50 border-blue-100";
  }
  if (category === "DOCUMENTS") {
    return "text-emerald-600 bg-emerald-50 border-emerald-100";
  }
  if (category === "COMMISSIONS") {
    return "text-amber-600 bg-amber-50 border-amber-100";
  }
  return "text-violet-600 bg-violet-50 border-violet-100";
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const viewAllHref = session?.user?.roleName === "STUDENT" ? "/student/notifications" : "/notifications";

  const { data } = useQuery<NotificationsPayload>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return (await res.json()) as NotificationsPayload;
    },
    refetchInterval: 5000,
  });

  const items = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const unreadImmigrationCount = data?.unreadImmigrationCount ?? 0;

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function openNotification(item: NotificationItem) {
    if (!item.isRead) {
      await fetch(`/api/notifications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }

    setOpen(false);
    if (item.linkUrl) router.push(item.linkUrl);
  }

  return (
    <div className="relative" ref={ref}>
      {session?.user?.roleName === "ADMIN" && unreadImmigrationCount > 0 && (
        <span className="absolute -top-3 right-0 z-30 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-300">
          Immigration Rule Update Detected
        </span>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 -mt-1 -mr-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-20 w-[380px] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Notifications</h4>
            <button
              onClick={markAllRead}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-72 overflow-auto">
            {items.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No notifications</div>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => openNotification(it)}
                  className="w-full border-b border-slate-100 px-4 py-3.5 text-left hover:bg-slate-50 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${iconColoursForCategory(it.category)}`}
                    >
                      {(() => {
                        const Icon = iconForCategory(it.category);
                        return <Icon className="h-4 w-4" />;
                      })()}
                    </span>

                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-sm font-medium leading-5 text-slate-800 whitespace-normal break-words">
                        {it.message}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {formatDistanceToNowStrict(parseISO(it.createdAt))} ago
                      </div>
                    </div>

                    <div className="flex h-5 w-4 shrink-0 items-start justify-end">
                      {!it.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-slate-100 flex items-center justify-between">
            <Link href={viewAllHref} className="text-xs text-blue-700 hover:underline" onClick={() => setOpen(false)}>
              View all
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
