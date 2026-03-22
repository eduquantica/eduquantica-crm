"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type MonitoredPage = {
  id: string;
  country: string;
  pageUrl: string;
  isActive: boolean;
  status: "ACTIVE" | "PAUSED" | "ERROR";
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
};

type AlertRow = {
  id: string;
  country: string;
  pageUrl: string;
  oldContent: string;
  newContent: string;
  diffSummary?: string | null;
  detectedAt: string;
  status: "PENDING_REVIEW" | "CONFIRMED_PUBLISHED" | "DISMISSED";
  oldMonthlyLivingCost: number | null;
  detectedMonthlyLivingCost: number | null;
  currency: string;
  currentSettingMonthlyLivingCost: number;
  currentSettingCurrency: string;
  settingsUpdatedAt: string | null;
  canConfirmPublish: boolean;
  confirmedAt: string | null;
  confirmedByUser?: { id: string; name: string | null; email: string | null } | null;
  changelog?: {
    id: string;
    summary: string;
    createdAt: string;
    confirmedByUser: { id: string; name: string | null; email: string | null };
  } | null;
};

function dt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB");
}

type Props = {
  roleName?: string | null;
};

export default function ImmigrationMonitorSettings({ roleName }: Props) {
  const [pages, setPages] = useState<MonitoredPage[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("UK");
  const [pageUrl, setPageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyByPage, setBusyByPage] = useState<Record<string, boolean>>({});
  const [confirmingByAlert, setConfirmingByAlert] = useState<Record<string, boolean>>({});

  const isAdmin = roleName === "ADMIN";

  async function loadAll() {
    setLoading(true);
    try {
      const [pagesRes, alertsRes] = await Promise.all([
        fetch("/api/admin/settings/immigration-monitor/pages", { cache: "no-store" }),
        fetch("/api/admin/settings/immigration-monitor/alerts", { cache: "no-store" }),
      ]);

      const pagesJson = await pagesRes.json();
      const alertsJson = await alertsRes.json();

      if (!pagesRes.ok) throw new Error(pagesJson.error || "Failed to load monitored pages");
      if (!alertsRes.ok) throw new Error(alertsJson.error || "Failed to load alert history");

      setPages(pagesJson.data || []);
      setAlerts(alertsJson.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load immigration monitor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function addPage() {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/immigration-monitor/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, pageUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add URL");

      setPageUrl("");
      toast.success("Monitored URL added.");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add URL");
    } finally {
      setSaving(false);
    }
  }

  async function removePage(id: string) {
    if (!isAdmin) return;
    setBusyByPage((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/settings/immigration-monitor/pages/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove URL");
      toast.success("Monitored URL removed.");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove URL");
    } finally {
      setBusyByPage((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function checkNow(id: string) {
    setBusyByPage((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/settings/immigration-monitor/pages/${id}/check`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to check URL");
      toast.success(json.data?.changed ? "Change detected and alert created." : "No change detected.");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check URL");
    } finally {
      setBusyByPage((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function confirmPublish(alertId: string) {
    if (!isAdmin) return;
    setConfirmingByAlert((prev) => ({ ...prev, [alertId]: true }));
    try {
      const res = await fetch(`/api/admin/settings/immigration-monitor/alerts/${alertId}/confirm`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to confirm update");
      toast.success("Update confirmed and published to all roles.");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm update");
    } finally {
      setConfirmingByAlert((prev) => ({ ...prev, [alertId]: false }));
    }
  }

  const pendingAlerts = useMemo(() => alerts.filter((item) => item.status === "PENDING_REVIEW"), [alerts]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading immigration monitor...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Add monitored government page</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[120px_1fr_auto]">
          <input
            list="immigration-country-options"
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Country code e.g. UK"
          />
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            placeholder="https://..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void addPage()}
              disabled={saving || !pageUrl.trim() || !country.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Adding..." : "+ Add URL"}
            </button>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Managers can review and run checks. Add/remove is Admin only.
            </div>
          )}
        </div>
        <datalist id="immigration-country-options">
          <option value="UK" />
          <option value="CA" />
          <option value="AU" />
          <option value="US" />
          <option value="IE" />
          <option value="NZ" />
        </datalist>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Country</th>
              <th className="px-3 py-2 text-left font-medium">URL</th>
              <th className="px-3 py-2 text-left font-medium">Last Checked</th>
              <th className="px-3 py-2 text-left font-medium">Last Changed</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2 font-medium text-slate-900">{page.country}</td>
                <td className="px-3 py-2 text-xs text-slate-600 break-all">{page.pageUrl}</td>
                <td className="px-3 py-2 text-slate-500">{dt(page.lastCheckedAt)}</td>
                <td className="px-3 py-2 text-slate-500">{dt(page.lastChangedAt)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${page.status === "ERROR" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {page.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void checkNow(page.id)}
                      disabled={Boolean(busyByPage[page.id])}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Check Now
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void removePage(page.id)}
                        disabled={Boolean(busyByPage[page.id])}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-500">No monitored URLs.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-900">Pending review alerts</h4>
        {pendingAlerts.length === 0 ? (
          <p className="text-sm text-slate-500">No pending alerts.</p>
        ) : (
          pendingAlerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{alert.country} rule change detected</p>
                  <p className="text-xs text-slate-600">{dt(alert.detectedAt)}</p>
                </div>
                <a href={alert.pageUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Review Official Page
                </a>
              </div>

              <p className="text-xs text-slate-600 break-all">{alert.pageUrl}</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs font-medium text-rose-700">Old text</p>
                  <p className="mt-1 text-xs text-rose-700 line-through whitespace-pre-wrap">{alert.oldContent.slice(0, 900) || "-"}</p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700">New text</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700 whitespace-pre-wrap">{alert.newContent.slice(0, 900) || "-"}</p>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <p>
                  Current setting in EduQuantica: <strong>{alert.currentSettingMonthlyLivingCost} {alert.currentSettingCurrency}</strong>
                </p>
                <p>
                  Detected figure on official page: <strong>{alert.detectedMonthlyLivingCost ?? "N/A"} {alert.currency}</strong>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href="/dashboard/settings#financial-requirements" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Update Settings
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    disabled={!alert.canConfirmPublish || Boolean(confirmingByAlert[alert.id])}
                    onClick={() => void confirmPublish(alert.id)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {confirmingByAlert[alert.id] ? "Publishing..." : "Confirm and Publish Update"}
                  </button>
                )}
              </div>
              {isAdmin && !alert.canConfirmPublish && (
                <p className="text-xs text-amber-700">Update Financial Requirements first, then confirm and publish.</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">Alert History</h4>
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {alerts.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">No alert history yet.</div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-3 text-sm">
                <p className="font-medium text-slate-900">{alert.country} • {alert.status}</p>
                <p className="text-xs text-slate-500">Detected: {dt(alert.detectedAt)}</p>
                {alert.confirmedAt && (
                  <p className="text-xs text-slate-600">
                    Confirmed by {alert.confirmedByUser?.name || alert.confirmedByUser?.email || "Admin"} on {dt(alert.confirmedAt)}
                  </p>
                )}
                {alert.changelog?.summary && <p className="mt-1 text-xs text-slate-700">{alert.changelog.summary}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
