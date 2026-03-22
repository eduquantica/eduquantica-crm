"use client";

import { useEffect, useState } from "react";

type StaffOption = { id: string; name: string; email: string };

const defaults = {
  period: "MONTHLY",
  periodLabel: "This Month",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  targetLeadsContacted: 30,
  targetLeadToStudent: 30,
  targetStudentToOffer: 50,
  targetOfferToDeposit: 40,
  targetDepositToVisa: 80,
  targetVisaToEnrolled: 70,
  targetOverallConversion: 15,
  targetEnrollments: 6,
};

export default function KpiDefaultSettingsCard() {
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/kpi/targets", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setStaff(json.data.staffOptions || []))
      .catch(() => setStaff([]));
  }, []);

  async function saveDefaults() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = { ...form, setByAdminDefault: true };
      for (const member of staff) {
        const res = await fetch("/api/dashboard/kpi/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, staffId: member.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to save defaults");
      }
      setMessage(`Saved default KPI targets for ${staff.length} counsellor(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save default targets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.period} onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value }))}>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="ANNUALLY">Annually</option>
          <option value="INTAKE_SEASON">Intake Season</option>
        </select>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.periodLabel} onChange={(e) => setForm((prev) => ({ ...prev, periodLabel: e.target.value }))} placeholder="Period Label" />
        <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
        <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetLeadsContacted} onChange={(e) => setForm((prev) => ({ ...prev, targetLeadsContacted: Number(e.target.value) }))} placeholder="Leads Contacted" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetLeadToStudent} onChange={(e) => setForm((prev) => ({ ...prev, targetLeadToStudent: Number(e.target.value) }))} placeholder="Lead to Student %" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetStudentToOffer} onChange={(e) => setForm((prev) => ({ ...prev, targetStudentToOffer: Number(e.target.value) }))} placeholder="Student to Offer %" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetOfferToDeposit} onChange={(e) => setForm((prev) => ({ ...prev, targetOfferToDeposit: Number(e.target.value) }))} placeholder="Offer to Deposit %" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetDepositToVisa} onChange={(e) => setForm((prev) => ({ ...prev, targetDepositToVisa: Number(e.target.value) }))} placeholder="Deposit to Visa %" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetVisaToEnrolled} onChange={(e) => setForm((prev) => ({ ...prev, targetVisaToEnrolled: Number(e.target.value) }))} placeholder="Visa to Enrolled %" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetOverallConversion} onChange={(e) => setForm((prev) => ({ ...prev, targetOverallConversion: Number(e.target.value) }))} placeholder="Overall Conversion %" />
        <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetEnrollments} onChange={(e) => setForm((prev) => ({ ...prev, targetEnrollments: Number(e.target.value) }))} placeholder="Target Enrollments" />
      </div>
      <button onClick={saveDefaults} disabled={saving || staff.length === 0} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {saving ? "Saving..." : "Save Default KPI Targets"}
      </button>
    </div>
  );
}
