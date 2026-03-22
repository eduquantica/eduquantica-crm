"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  createdAt: string;
  assignedCounsellor: { id: string; name: string | null } | null;
};

type CounsellorOption = { id: string; name: string };

type PerformanceRow = {
  counsellorId: string;
  counsellorName: string;
  leadsAllocated: number;
  leadsContacted: number;
  leadsConvertedToStudents: number;
  contactRate: number;
  conversionRate: number;
};

export default function AgentLeadsClient() {
  const [tab, setTab] = useState<"register" | "performance">("register");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [counsellors, setCounsellors] = useState<CounsellorOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [allocation, setAllocation] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAlloc, setShowAlloc] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "",
    source: "WEBSITE",
    notes: "",
  });

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (allocation) params.set("allocation", allocation);
      const res = await fetch(`/api/agent/leads?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load leads");
      setRows(json.data.leads || []);
      setCounsellors(json.data.counsellors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformance() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/leads/allocation/performance", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load performance");
      setPerformance(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load performance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "performance") loadPerformance();
    else loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function applyFilters() {
    await loadLeads();
  }

  async function submitAllocation(single: boolean) {
    if (!targetId) return;
    setSaving(true);
    setError(null);
    try {
      const body = single
        ? { leadId, allocatedToId: targetId, notes: notes || null }
        : { leadIds: selected, allocatedToId: targetId, notes: notes || null };
      const res = await fetch("/api/agent/leads/allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Allocation failed");

      setShowAlloc(false);
      setShowBulk(false);
      setLeadId(null);
      setSelected([]);
      setTargetId("");
      setNotes("");
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Allocation failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitNewLead() {
    const firstName = newLead.firstName.trim();
    const lastName = newLead.lastName.trim();
    if (!firstName || !lastName) {
      setError("First name and last name are required.");
      return;
    }

    setCreatingLead(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create lead");

      setShowCreateLead(false);
      setNewLead({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        nationality: "",
        source: "WEBSITE",
        notes: "",
      });
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setCreatingLead(false);
    }
  }

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-600">Manage and allocate leads inside your sub-agent organisation.</p>
      </div>

      <div className="flex items-center gap-2">
        <button className={cn("rounded-md px-3 py-2 text-sm font-medium", tab === "register" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700")} onClick={() => setTab("register")}>Leads</button>
        <button className={cn("rounded-md px-3 py-2 text-sm font-medium", tab === "performance" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700")} onClick={() => setTab("performance")}>Allocation Performance</button>
      </div>

      {tab === "register" && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">All status</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
              </select>
              <select value={allocation} onChange={(e) => setAllocation(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Allocation</option>
                <option value="UNALLOCATED">Unallocated</option>
                <option value="ME">Allocated to me</option>
                {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={applyFilters} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Apply</button>
              <button onClick={() => setShowCreateLead(true)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Add New Lead</button>
              <button onClick={() => setShowBulk(true)} disabled={selected.length === 0} className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40">Bulk Allocate</button>
            </div>
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={allSelected} onChange={(e) => {
                      if (e.target.checked) setSelected(Array.from(new Set([...selected, ...allIds])));
                      else setSelected((prev) => prev.filter((id) => !allIds.includes(id)));
                    }} />
                  </th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Allocation</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-5 text-slate-500">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-5 text-slate-500">No leads found.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.includes(row.id)} onChange={(e) => {
                      if (e.target.checked) setSelected((prev) => [...prev, row.id]);
                      else setSelected((prev) => prev.filter((id) => id !== row.id));
                    }} /></td>
                    <td className="px-3 py-2"><Link href={`/dashboard/leads/${row.id}`} className="text-blue-600 hover:underline">{row.firstName} {row.lastName}</Link></td>
                    <td className="px-3 py-2 text-slate-700">{row.source}</td>
                    <td className="px-3 py-2 text-slate-700">{row.status}</td>
                    <td className="px-3 py-2 text-slate-700">{row.assignedCounsellor?.name || "Unallocated"}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => { setLeadId(row.id); setShowAlloc(true); }} className="text-xs text-blue-600 hover:underline">Allocate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "performance" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2">Counsellor</th>
                <th className="px-3 py-2">Leads Allocated</th>
                <th className="px-3 py-2">Leads Contacted</th>
                <th className="px-3 py-2">Leads Converted</th>
                <th className="px-3 py-2">Contact Rate</th>
                <th className="px-3 py-2">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-5 text-slate-500">Loading...</td></tr>
              ) : performance.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-5 text-slate-500">No data.</td></tr>
              ) : performance.map((row) => (
                <tr key={row.counsellorId} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.counsellorName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.leadsAllocated}</td>
                  <td className="px-3 py-2 text-slate-700">{row.leadsContacted}</td>
                  <td className="px-3 py-2 text-slate-700">{row.leadsConvertedToStudents}</td>
                  <td className="px-3 py-2 text-slate-700">{row.contactRate}%</td>
                  <td className="px-3 py-2 text-slate-700">{row.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showAlloc || showBulk) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{showBulk ? "Bulk Allocate Leads" : "Allocate Lead"}</h3>
            <div className="mt-4 space-y-3">
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select counsellor</option>
                {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Notes (optional)" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowAlloc(false); setShowBulk(false); }} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
              <button disabled={saving || !targetId} onClick={() => submitAllocation(!showBulk)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Allocate</button>
            </div>
          </div>
        </div>
      )}

      {showCreateLead && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Add New Lead</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={newLead.firstName} onChange={(e) => setNewLead((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="First name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input value={newLead.lastName} onChange={(e) => setNewLead((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Last name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input value={newLead.email} onChange={(e) => setNewLead((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input value={newLead.phone} onChange={(e) => setNewLead((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input value={newLead.nationality} onChange={(e) => setNewLead((prev) => ({ ...prev, nationality: e.target.value }))} placeholder="Nationality" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <select value={newLead.source} onChange={(e) => setNewLead((prev) => ({ ...prev, source: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="WEBSITE">Website</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="GOOGLE_ADS">Google Ads</option>
                <option value="REFERRAL">Referral</option>
                <option value="WALK_IN">Walk-In</option>
              </select>
              <textarea value={newLead.notes} onChange={(e) => setNewLead((prev) => ({ ...prev, notes: e.target.value }))} rows={3} placeholder="Notes" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowCreateLead(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
              <button disabled={creatingLead} onClick={submitNewLead} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Create Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
