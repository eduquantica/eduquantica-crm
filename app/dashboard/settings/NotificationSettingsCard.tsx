"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type SettingsPayload = {
  data: {
    portal: boolean;
    email: boolean;
    sms: boolean;
  };
};

export default function NotificationSettingsCard() {
  const { data, refetch, isLoading } = useQuery<SettingsPayload>({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return (await res.json()) as SettingsPayload;
    },
  });

  const [saving, setSaving] = useState(false);

  async function update(next: Partial<SettingsPayload["data"]>) {
    setSaving(true);
    try {
      await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  const settings = data?.data ?? { portal: true, email: true, sms: false };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <span className="text-slate-700">In-portal notifications</span>
        <input
          type="checkbox"
          checked={settings.portal}
          disabled={isLoading || saving}
          onChange={(e) => update({ portal: e.target.checked })}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <span className="text-slate-700">Email digest summaries</span>
        <input
          type="checkbox"
          checked={settings.email}
          disabled={isLoading || saving}
          onChange={(e) => update({ email: e.target.checked })}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <span className="text-slate-700">SMS alerts</span>
        <input
          type="checkbox"
          checked={settings.sms}
          disabled={isLoading || saving}
          onChange={(e) => update({ sms: e.target.checked })}
        />
      </div>
      <p className="text-xs text-slate-500">{saving ? "Saving..." : "Settings are saved to your account."}</p>
    </div>
  );
}
