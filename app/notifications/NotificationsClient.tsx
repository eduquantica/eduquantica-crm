"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  category: "APPLICATIONS" | "DOCUMENTS" | "COMMISSIONS" | "SYSTEM";
  createdAt: string;
  immigrationAlert?: {
    id: string;
    country: string;
    pageUrl: string;
    oldContent: string;
    newContent: string;
    oldMonthlyLivingCost: number | null;
    newMonthlyLivingCost: number | null;
    currency: string | null;
    detectedAt: string;
    status: "PENDING_REVIEW" | "CONFIRMED_PUBLISHED" | "DISMISSED";
  } | null;
};

type TabFilter = "ALL" | "UNREAD" | "APPLICATIONS" | "DOCUMENTS" | "COMMISSIONS" | "SYSTEM" | "FINANCE" | "MESSAGES";

type NotificationsPayload = {
  data: NotificationItem[];
  unreadCount: number;
  unreadImmigrationCount?: number;
};

const DEFAULT_TABS: Array<{ key: TabFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "APPLICATIONS", label: "Applications" },
  { key: "DOCUMENTS", label: "Documents" },
  { key: "COMMISSIONS", label: "Commissions" },
  { key: "SYSTEM", label: "System" },
];

const STUDENT_TABS: Array<{ key: TabFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "FINANCE", label: "Finance" },
  { key: "MESSAGES", label: "Messages" },
];

export default function NotificationsClient({ homePath, variant = "default" }: { homePath: string; variant?: "default" | "student" }) {
  const [tab, setTab] = useState<TabFilter>("ALL");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const tabs = variant === "student" ? STUDENT_TABS : DEFAULT_TABS;

  const { data, isLoading } = useQuery<NotificationsPayload>({
    queryKey: ["notifications", tab],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?tab=${tab}&limit=200`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return (await res.json()) as NotificationsPayload;
    },
    refetchInterval: 10000,
  });

  const items = useMemo(() => data?.data ?? [], [data]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function removeNotification(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function confirmImmigrationAlert(alertId: string) {
    const res = await fetch(`/api/admin/settings/immigration-monitor/alerts/${alertId}/confirm`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to confirm update");
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Unread: {data?.unreadCount ?? 0}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={markAllRead} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Mark all read
          </button>
          <Link href={homePath} className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700">
            Back to portal
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === item.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No notifications in this tab.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {item.message}
                  {!item.isRead && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-600" />}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.type} • {formatDistanceToNowStrict(parseISO(item.createdAt))} ago</p>
                {item.immigrationAlert && (
                  <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">{item.immigrationAlert.country} immigration rule update</p>
                    <a href={item.immigrationAlert.pageUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 hover:underline">
                      Review Official Page
                    </a>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                        <p className="text-[11px] font-medium text-rose-700">Old text</p>
                        <p className="mt-1 text-[11px] text-rose-700 line-through whitespace-pre-wrap">{item.immigrationAlert.oldContent.slice(0, 450)}</p>
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                        <p className="text-[11px] font-medium text-emerald-700">New text</p>
                        <p className="mt-1 text-[11px] font-semibold text-emerald-700 whitespace-pre-wrap">{item.immigrationAlert.newContent.slice(0, 450)}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Detected figure: <strong>{item.immigrationAlert.newMonthlyLivingCost ?? "N/A"} {item.immigrationAlert.currency || ""}</strong>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/dashboard/settings#financial-requirements" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50">
                        Update Settings
                      </Link>
                      {session?.user?.roleName === "ADMIN" && item.immigrationAlert.status === "PENDING_REVIEW" && (
                        <button
                          onClick={async () => {
                            try {
                              await confirmImmigrationAlert(item.immigrationAlert!.id);
                              toast.success("Update confirmed and published.");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Unable to confirm update");
                            }
                          }}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          Confirm and Publish Update
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {item.linkUrl && (
                  <Link href={item.linkUrl} className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
                    Open related item
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!item.isRead && (
                  <button onClick={() => markRead(item.id)} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    Mark read
                  </button>
                )}
                <button onClick={() => removeNotification(item.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
