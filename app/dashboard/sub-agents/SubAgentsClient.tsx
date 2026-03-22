"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StatusFilter = "ALL" | "APPROVED" | "SUSPENDED";
type TierFilter = "ALL" | "GOLD" | "SILVER" | "PLATINUM";

type Row = {
  id: string;
  agencyName: string;
  contactName: string;
  country: string;
  status: "APPROVED" | "SUSPENDED";
  students: number;
  enrolments: number;
  tier: "GOLD" | "SILVER" | "PLATINUM";
  rate: number;
};

type Filters = {
  countries: string[];
  tiers: Array<"GOLD" | "SILVER" | "PLATINUM">;
};

function tierBadge(tier: Row["tier"]) {
  if (tier === "PLATINUM") return "bg-purple-100 text-purple-700";
  if (tier === "SILVER") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

export default function SubAgentsClient({ viewerRole }: { viewerRole: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filters, setFilters] = useState<Filters>({ countries: [], tiers: [] });
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [country, setCountry] = useState("ALL");
  const [tier, setTier] = useState<TierFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("80");
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (country !== "ALL") params.set("country", country);
    if (tier !== "ALL") params.set("tier", tier);
    return params.toString();
  }, [status, country, tier]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents${query ? `?${query}` : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load sub-agents");
      setRows(json.data.rows || []);
      setFilters(json.data.filters || { countries: [], tiers: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sub-agents");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  async function runAction(id: string, action: "suspend" | "activate") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function saveRate(id: string) {
    const rate = Number(rateInput);
    if (!Number.isFinite(rate)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "editRate", rate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update rate");
      setEditingRateId(null);
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Sub-Agents</h1>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="border rounded-md px-3 py-2 text-sm">
          <option value="ALL">Status: All</option>
          <option value="APPROVED">Approved</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="ALL">Country: All</option>
          {filters.countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value as TierFilter)} className="border rounded-md px-3 py-2 text-sm">
          <option value="ALL">Tier: All</option>
          {filters.tiers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">Agency Name</th>
              <th className="px-4 py-3">Contact Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Enrolments</th>
              <th className="px-4 py-3">Tier badge</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-5 text-slate-600" colSpan={9}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-5 text-slate-600" colSpan={9}>No sub-agents found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{row.agencyName}</td>
                <td className="px-4 py-3">{row.contactName}</td>
                <td className="px-4 py-3">{row.country}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${row.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">{row.students}</td>
                <td className="px-4 py-3">{row.enrolments}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${tierBadge(row.tier)}`}>{row.tier}</span>
                </td>
                <td className="px-4 py-3">{row.rate.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/dashboard/applications?subAgentId=${encodeURIComponent(row.id)}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Applications</Link>
                    <Link href={`/dashboard/sub-agents/${row.id}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">View Profile</Link>
                    <button
                      onClick={() => {
                        setEditingRateId(row.id);
                        setRateInput(String(row.rate));
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Edit Rate
                    </button>
                    {row.status === "APPROVED" ? (
                      <button disabled={saving || viewerRole !== "ADMIN"} onClick={() => runAction(row.id, "suspend")} className="rounded-md border border-rose-300 text-rose-700 px-2 py-1 text-xs hover:bg-rose-50 disabled:opacity-50">Suspend</button>
                    ) : (
                      <button disabled={saving || viewerRole !== "ADMIN"} onClick={() => runAction(row.id, "activate")} className="rounded-md border border-emerald-300 text-emerald-700 px-2 py-1 text-xs hover:bg-emerald-50 disabled:opacity-50">Activate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRateId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 w-full max-w-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Edit Commission Rate</h2>
            <input value={rateInput} onChange={(e) => setRateInput(e.target.value)} type="number" max={90} min={0} step={0.01} className="w-full border rounded-md px-3 py-2 text-sm" />
            <p className="text-xs text-slate-500">Hard cap is 90%.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingRateId(null)} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs">Cancel</button>
              <button onClick={() => saveRate(editingRateId)} disabled={saving} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
