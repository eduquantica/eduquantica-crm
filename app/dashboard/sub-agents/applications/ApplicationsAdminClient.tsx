"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

type Status = "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED";
type Tier = "GOLD" | "SILVER" | "PLATINUM";

type Row = {
  id: string;
  agencyName: string;
  agencyCountry: string | null;
  approvalStatus: Status;
  createdAt: string;
  user: { name: string | null; email: string };
};

type Detail = {
  id: string;
  agencyName: string;
  firstName?: string | null;
  lastName?: string | null;
  businessEmail?: string | null;
  phone: string | null;
  website: string | null;
  agencyCountry: string | null;
  agencyCity: string | null;
  createdAt: string;
  approvalStatus: Status;
};

const BADGE: Record<Status, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  INFO_REQUESTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function ApplicationsAdminClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState<Tier>("GOLD");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchRows();
  }, []);

  async function fetchRows() {
    setLoading(true);
    const res = await fetch("/api/admin/sub-agents/applications?limit=100");
    const json = await res.json();
    if (res.ok) setRows(json.data || []);
    setLoading(false);
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    const res = await fetch(`/api/admin/sub-agents/applications/${id}`);
    const json = await res.json();
    if (res.ok) setDetail(json.data);
  }

  async function runAction(action: "approve" | "request-info" | "reject") {
    if (!selectedId) return;
    setSaving(true);
    const payload: Record<string, unknown> = {};

    if (action === "approve") payload.tier = tier;
    if (action === "request-info") payload.message = message;
    if (action === "reject") payload.reason = reason;

    const res = await fetch(`/api/admin/sub-agents/applications/${selectedId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      await openDetail(selectedId);
      await fetchRows();
      setMessage("");
      setReason("");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sub-Agent Applications</h1>
        <p className="text-sm text-slate-500 mt-1">Review and approve registration requests.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3">Agency Name</th>
                <th className="px-4 py-3">Contact Name</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Date Applied</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{row.agencyName}</td>
                  <td className="px-4 py-3">{row.user.name || "-"}</td>
                  <td className="px-4 py-3">{row.agencyCountry || "-"}</td>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${BADGE[row.approvalStatus]}`}>{row.approvalStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(row.id)} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="relative w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Application Detail</h2>
              <button onClick={() => setSelectedId(null)} className="p-2 border rounded-md"><X className="w-4 h-4" /></button>
            </div>

            {!detail ? (
              <div className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <p><span className="text-slate-500">Agency:</span> {detail.agencyName}</p>
                  <p><span className="text-slate-500">Status:</span> {detail.approvalStatus}</p>
                  <p><span className="text-slate-500">Name:</span> {`${detail.firstName || ""} ${detail.lastName || ""}`.trim() || "-"}</p>
                  <p><span className="text-slate-500">Email:</span> {detail.businessEmail || "-"}</p>
                  <p><span className="text-slate-500">Country:</span> {detail.agencyCountry || "-"}</p>
                  <p><span className="text-slate-500">City:</span> {detail.agencyCity || "-"}</p>
                  <p><span className="text-slate-500">Phone:</span> {detail.phone || "-"}</p>
                  <p><span className="text-slate-500">Website:</span> {detail.website || "-"}</p>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">Approve</h3>
                    <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="w-full border rounded-md px-3 py-2 text-sm">
                      <option value="GOLD">Gold 80%</option>
                      <option value="SILVER">Silver 85%</option>
                      <option value="PLATINUM">Platinum 90%</option>
                    </select>
                    <button disabled={saving} onClick={() => runAction("approve")} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">Approve</button>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">Request More Info</h3>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Type a message" />
                    <button disabled={saving || !message.trim()} onClick={() => runAction("request-info")} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">Request More Info</button>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">Reject</h3>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Type rejection reason" />
                    <button disabled={saving || !reason.trim()} onClick={() => runAction("reject")} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">Reject</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
