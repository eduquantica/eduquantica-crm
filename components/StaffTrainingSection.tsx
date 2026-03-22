"use client";

import { FormEvent, useEffect, useState } from "react";

type RecordRow = {
  id: string;
  completionDate: string | Date;
  expiryDate?: string | Date | null;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "RENEWED";
  certificateUrl?: string | null;
  notes?: string | null;
  training: {
    id: string;
    name: string;
    deliveredBy?: string | null;
  };
};

type Props = {
  endpoint: string;
  canManage: boolean;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
}

function statusClass(status: RecordRow["status"]) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "EXPIRING_SOON") return "bg-amber-100 text-amber-700";
  if (status === "EXPIRED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function StaffTrainingSection({ endpoint, canManage }: Props) {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load training records");
      setRecords(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function uploadCertificate(file: File) {
    const formData = new FormData();
    formData.append("files", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json() as { urls?: string[]; error?: string; message?: string };
    if (!res.ok) throw new Error(json.error || "Upload failed");
    return {
      url: (json.urls?.[0] as string) || "",
      message: json.message || "",
    };
  }

  async function addRecord(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          completionDate,
          expiryDate: expiryDate || null,
          deliveredBy: deliveredBy || null,
          certificateUrl: certificateUrl || null,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add training record");

      setShowAdd(false);
      setName("");
      setCompletionDate("");
      setExpiryDate("");
      setDeliveredBy("");
      setCertificateUrl("");
      setNotes("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add training record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Training Records</h2>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add Record
          </button>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>}

      {loading ? (
        <div className="text-sm text-slate-600">Loading training records...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2">Training</th>
                <th className="px-3 py-2">Completion</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{row.training.name}</p>
                    <p className="text-xs text-slate-500">{row.training.deliveredBy || "-"}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{formatDate(row.completionDate)}</td>
                  <td className="px-3 py-2 text-slate-700">{formatDate(row.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.certificateUrl ? (
                      <a href={row.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">No training records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Training Record</h3>
            <form onSubmit={addRecord} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Training Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Completion Date</label>
                <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Expiry Date</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Delivered By</label>
                <input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Certificate URL</label>
                <div className="flex gap-2">
                  <input value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
                  <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setSaving(true);
                          setError(null);
                          setInfo(null);
                          const { url, message } = await uploadCertificate(file);
                          setCertificateUrl(url);
                          if (message) {
                            setInfo(message);
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setSaving(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
