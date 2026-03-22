"use client";

import { useState } from "react";

type FollowUpType = "CALL" | "EMAIL" | "MEETING" | "WHATSAPP";

type Props = {
  entityType: "student" | "lead";
  entityId: string;
  entityName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function FollowUpModal({ entityType, entityId, entityName, isOpen, onClose, onSaved }: Props) {
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = now.toTimeString().slice(0, 5);

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [type, setType] = useState<FollowUpType>("CALL");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function saveFollowUp() {
    if (!date || !time) {
      setError("Follow-up date and time are required.");
      return;
    }

    const followUpDateTime = new Date(`${date}T${time}`);
    if (Number.isNaN(followUpDateTime.getTime())) {
      setError("Invalid follow-up date/time.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endpoint = entityType === "lead"
        ? `/api/leads/${entityId}/followups`
        : `/api/students/${entityId}/followups`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpDateTime: followUpDateTime.toISOString(),
          type,
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to schedule follow-up");

      onSaved?.();
      onClose();
      setNotes("");
      setType("CALL");
      setDate(defaultDate);
      setTime(defaultTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Schedule Follow-Up</h3>
        <p className="mt-1 text-sm text-slate-600">{entityName}</p>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as FollowUpType)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={saving} onClick={saveFollowUp} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}
