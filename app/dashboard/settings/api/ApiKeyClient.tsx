"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";

interface ApiKeyClientProps {
  initialKey: string | null;
  facebookVerifyToken: string | null;
}

export default function ApiKeyClient({ initialKey, facebookVerifyToken }: ApiKeyClientProps) {
  const [apiKey, setApiKey] = useState(initialKey || "");
  const [regenerating, setRegenerating] = useState(false);
  const [scanSettings, setScanSettings] = useState({
    plagiarismGreenMax: 15,
    plagiarismAmberMax: 30,
    aiGreenMax: 20,
    aiAmberMax: 40,
    autoApproveGreen: false,
    autoAlertAdmin: true,
  });
  const [loadingScanSettings, setLoadingScanSettings] = useState(true);
  const [savingScanSettings, setSavingScanSettings] = useState(false);
  const [loadingCurrency, setLoadingCurrency] = useState(true);
  const [refreshingCurrency, setRefreshingCurrency] = useState(false);
  const [currencyData, setCurrencyData] = useState<{
    lastRefreshAt: string | null;
    source: string | null;
    rates: Array<{
      id: string;
      baseCurrency: string;
      targetCurrency: string;
      rate: number;
      source: string | null;
      updatedAt: string;
    }>;
  }>({
    lastRefreshAt: null,
    source: null,
    rates: [],
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function copyText(value: string, successLabel: string) {
    try {
      await navigator.clipboard.writeText(value);
      alert(successLabel);
    } catch {
      alert("Failed to copy");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      alert("API key copied to clipboard");
    } catch {
      alert("Failed to copy");
    }
  }

  async function handleRegenerate() {
    if (!confirm("Are you sure you want to generate a new API key? Existing integrations will break.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/admin/settings/api-key", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate");
      const data = await res.json();
      setApiKey(data.apiKey);
      alert("API key regenerated");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to regenerate API key");
    } finally {
      setRegenerating(false);
    }
  }

  async function fetchScanSettings() {
    setLoadingScanSettings(true);
    try {
      const res = await fetch("/api/admin/settings/scan");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load scan settings");
      setScanSettings(data.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load scan settings");
    } finally {
      setLoadingScanSettings(false);
    }
  }

  async function saveScanSettings() {
    setSavingScanSettings(true);
    try {
      const res = await fetch("/api/admin/settings/scan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanSettings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save scan settings");
      setScanSettings(data.data);
      alert("Scan settings saved");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save scan settings");
    } finally {
      setSavingScanSettings(false);
    }
  }

  async function fetchCurrencySettings() {
    setLoadingCurrency(true);
    try {
      const res = await fetch("/api/admin/settings/currency");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load currency settings");
      setCurrencyData(data.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load currency settings");
    } finally {
      setLoadingCurrency(false);
    }
  }

  async function refreshCurrencyNow() {
    setRefreshingCurrency(true);
    try {
      const res = await fetch("/api/admin/settings/currency/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to refresh currency rates");
      await fetchCurrencySettings();
      alert(`Currency rates refreshed (${data.data.refreshedPairs} pairs)`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to refresh currency rates");
    } finally {
      setRefreshingCurrency(false);
    }
  }

  useEffect(() => {
    fetchScanSettings();
    fetchCurrencySettings();
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          The API key is used by external systems when posting leads via webhooks.
        </p>
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Lead Capture Endpoints</h3>
          <div className="space-y-2">
            {[
              { label: "Facebook Webhook", url: `${baseUrl}/api/webhooks/facebook` },
              { label: "Website Webhook", url: `${baseUrl}/api/webhooks/website` },
              { label: "Lead Import API", url: `${baseUrl}/api/leads/import` },
            ].map((endpoint) => (
              <div key={endpoint.label} className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={endpoint.url}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-gray-100 text-sm"
                />
                <button
                  type="button"
                  onClick={() => copyText(endpoint.url, `${endpoint.label} URL copied`) }
                  className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-xs"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">Facebook Verify Token</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={facebookVerifyToken || ""}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-gray-100 text-sm"
              />
              <button
                type="button"
                onClick={() => copyText(facebookVerifyToken || "", "Facebook verify token copied")}
                className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-xs"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
            <p className="font-medium text-slate-900">Facebook setup instructions</p>
            <p>1. In Facebook Lead Ads, set callback URL to the Facebook Webhook URL above.</p>
            <p>2. Paste the Facebook Verify Token above into Facebook webhook verification.</p>
            <p>3. Subscribe to leadgen events and save.</p>
            <p>4. Send a test lead from Facebook; the assigned counsellor should receive notification and email.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={apiKey}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-gray-100 text-sm"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
          >
            {regenerating ? (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Regenerate Key
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Scan Settings</h3>

        {loadingScanSettings ? (
          <p className="text-sm text-slate-500">Loading scan settings...</p>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-700">Plagiarism Green Max ({scanSettings.plagiarismGreenMax}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scanSettings.plagiarismGreenMax}
                  onChange={(e) => setScanSettings((prev) => ({ ...prev, plagiarismGreenMax: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-slate-700">Plagiarism Amber Max ({scanSettings.plagiarismAmberMax}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scanSettings.plagiarismAmberMax}
                  onChange={(e) => setScanSettings((prev) => ({ ...prev, plagiarismAmberMax: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-slate-700">AI Green Max ({scanSettings.aiGreenMax}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scanSettings.aiGreenMax}
                  onChange={(e) => setScanSettings((prev) => ({ ...prev, aiGreenMax: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-slate-700">AI Amber Max ({scanSettings.aiAmberMax}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scanSettings.aiAmberMax}
                  onChange={(e) => setScanSettings((prev) => ({ ...prev, aiAmberMax: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scanSettings.autoApproveGreen}
                  onChange={(e) => setScanSettings((prev) => ({ ...prev, autoApproveGreen: e.target.checked }))}
                />
                Auto-approve GREEN results
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scanSettings.autoAlertAdmin}
                  onChange={(e) => setScanSettings((prev) => ({ ...prev, autoAlertAdmin: e.target.checked }))}
                />
                Send admin email alerts for RED results
              </label>
            </div>

            <button
              type="button"
              onClick={saveScanSettings}
              disabled={savingScanSettings}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:opacity-90 disabled:opacity-50"
            >
              {savingScanSettings ? "Saving..." : "Save Scan Settings"}
            </button>
          </>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Currency</h3>
            <p className="text-sm text-slate-600">
              Last refresh: {currencyData.lastRefreshAt ? new Date(currencyData.lastRefreshAt).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : "Never"}
              {currencyData.source ? ` • Source: ${currencyData.source}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshCurrencyNow}
            disabled={refreshingCurrency}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:opacity-90 disabled:opacity-50"
          >
            {refreshingCurrency ? "Refreshing..." : "Refresh Now"}
          </button>
        </div>

        {loadingCurrency ? (
          <p className="text-sm text-slate-500">Loading currency rates...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Base</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Rate</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {currencyData.rates.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={5}>No rates available</td>
                  </tr>
                ) : (
                  currencyData.rates.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{row.baseCurrency}</td>
                      <td className="py-2 pr-4">{row.targetCurrency}</td>
                      <td className="py-2 pr-4">{row.rate}</td>
                      <td className="py-2 pr-4">{row.source || "-"}</td>
                      <td className="py-2 pr-4">{new Date(row.updatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
