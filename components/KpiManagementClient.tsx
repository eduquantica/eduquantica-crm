"use client";

import { useEffect, useMemo, useState } from "react";

type TargetRow = {
  id: string;
  staffId: string;
  period: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "INTAKE_SEASON";
  periodLabel: string;
  startDate: string;
  endDate: string;
  targetLeadsContacted: number;
  targetLeadToStudent: number;
  targetStudentToOffer: number;
  targetOfferToDeposit: number;
  targetDepositToVisa: number;
  targetVisaToEnrolled: number;
  targetOverallConversion: number;
  targetEnrollments: number;
  setByAdminDefault: boolean;
  overriddenByManager: boolean;
  staff: { id: string; name: string | null; email: string };
};

type ResultRow = {
  id: string;
  periodLabel: string;
  actualLeadsContacted: number;
  leadToStudentRate: number;
  actualStudentsWithOffer: number;
  actualDepositPaid: number;
  actualVisaApplied: number;
  actualEnrolled: number;
  achievementPercentage: number;
  overallConversionRate: number;
  staff: { id: string; name: string | null; email: string };
  kpiTarget: {
    targetLeadsContacted: number;
    targetLeadToStudent: number;
    targetEnrollments: number;
  };
};

type StaffOption = { id: string; name: string; email: string };

type Props = {
  variant: "dashboard" | "agent";
  canEdit: boolean;
};

const defaultForm = {
  staffId: "",
  period: "MONTHLY",
  periodLabel: "",
  startDate: "",
  endDate: "",
  targetLeadsContacted: 0,
  targetLeadToStudent: 0,
  targetStudentToOffer: 0,
  targetOfferToDeposit: 0,
  targetDepositToVisa: 0,
  targetVisaToEnrolled: 0,
  targetOverallConversion: 0,
  targetEnrollments: 0,
};

function achievementClass(value: number) {
  if (value >= 90) return "bg-emerald-100 text-emerald-700";
  if (value >= 70) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function KpiManagementClient({ variant, canEdit }: Props) {
  const apiBase = variant === "dashboard" ? "/api/dashboard/kpi" : "/api/agent/kpi";

  const [tab, setTab] = useState<"targets" | "intake" | "performance">("targets");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState({ teamLeadContactRate: 0, teamConversionRate: 0, teamEnrollments: 0, teamAchievement: 0 });
  const [showModal, setShowModal] = useState(false);
  const [modalStaff, setModalStaff] = useState<StaffOption | null>(null);
  const [form, setForm] = useState(defaultForm);

  const filteredTargets = useMemo(() => {
    if (tab === "intake") return targets.filter((row) => row.period === "INTAKE_SEASON");
    return targets.filter((row) => row.period !== "INTAKE_SEASON");
  }, [targets, tab]);

  async function loadTargets() {
    const periodParam = tab === "intake" ? "period=INTAKE_SEASON" : "";
    const res = await fetch(`${apiBase}/targets${periodParam ? `?${periodParam}` : ""}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load targets");
    setTargets(json.data.targets || []);
  }

  async function loadPerformance() {
    const [overviewRes, resultsRes] = await Promise.all([
      fetch(`${apiBase}/overview`, { cache: "no-store" }),
      fetch(`${apiBase}/results`, { cache: "no-store" }),
    ]);

    const [overviewJson, resultsJson] = await Promise.all([overviewRes.json(), resultsRes.json()]);
    if (!overviewRes.ok) throw new Error(overviewJson.error || "Failed to load overview");
    if (!resultsRes.ok) throw new Error(resultsJson.error || "Failed to load results");

    setResults(overviewJson.data.rows || resultsJson.data || []);
    setSummary(overviewJson.data.summary || { teamLeadContactRate: 0, teamConversionRate: 0, teamEnrollments: 0, teamAchievement: 0 });
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      if (tab === "performance") await loadPerformance();
      else await loadTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load KPI management");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function openOverride(staff: StaffOption) {
    setModalStaff(staff);
    const existing = targets.find((row) => row.staffId === staff.id && (tab === "intake" ? row.period === "INTAKE_SEASON" : row.period !== "INTAKE_SEASON"));
    setForm(existing ? {
      staffId: staff.id,
      period: existing.period,
      periodLabel: existing.periodLabel,
      startDate: new Date(existing.startDate).toISOString().slice(0, 10),
      endDate: new Date(existing.endDate).toISOString().slice(0, 10),
      targetLeadsContacted: existing.targetLeadsContacted,
      targetLeadToStudent: existing.targetLeadToStudent,
      targetStudentToOffer: existing.targetStudentToOffer,
      targetOfferToDeposit: existing.targetOfferToDeposit,
      targetDepositToVisa: existing.targetDepositToVisa,
      targetVisaToEnrolled: existing.targetVisaToEnrolled,
      targetOverallConversion: existing.targetOverallConversion,
      targetEnrollments: existing.targetEnrollments,
    } : {
      ...defaultForm,
      staffId: staff.id,
      period: tab === "intake" ? "INTAKE_SEASON" : "MONTHLY",
      periodLabel: tab === "intake" ? "September Intake" : "This Month",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  }

  async function saveOverride() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        setByAdminDefault: variant === "dashboard" && !form.staffId,
      };
      const res = await fetch(`${apiBase}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save target");
      setShowModal(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save target");
    } finally {
      setSaving(false);
    }
  }

  async function calculateResult(targetId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to calculate result");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate result");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className={`rounded-md px-3 py-2 text-sm font-medium ${tab === "targets" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => setTab("targets")}>Set KPI Targets</button>
        <button className={`rounded-md px-3 py-2 text-sm font-medium ${tab === "intake" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => setTab("intake")}>Intake Season Targets</button>
        <button className={`rounded-md px-3 py-2 text-sm font-medium ${tab === "performance" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => setTab("performance")}>Performance Overview</button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {tab !== "performance" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Counsellor Targets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-2 py-2">Counsellor</th>
                  <th className="px-2 py-2">Period</th>
                  <th className="px-2 py-2">Leads Target</th>
                  <th className="px-2 py-2">Lead→Student %</th>
                  <th className="px-2 py-2">Enrollments Target</th>
                  <th className="px-2 py-2">Mode</th>
                  {canEdit && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-2 py-5 text-slate-500">Loading...</td></tr>
                ) : filteredTargets.length === 0 ? (
                  <tr><td colSpan={7} className="px-2 py-5 text-slate-500">No KPI targets set.</td></tr>
                ) : (
                  filteredTargets.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-900">{row.staff.name || row.staff.email}</td>
                      <td className="px-2 py-2 text-slate-700">{row.periodLabel}</td>
                      <td className="px-2 py-2 text-slate-700">{row.targetLeadsContacted}</td>
                      <td className="px-2 py-2 text-slate-700">{row.targetLeadToStudent}%</td>
                      <td className="px-2 py-2 text-slate-700">{row.targetEnrollments}</td>
                      <td className="px-2 py-2 text-slate-700">{row.overriddenByManager ? "Custom" : row.setByAdminDefault ? "Admin Default" : "Standard"}</td>
                      {canEdit && (
                        <td className="px-2 py-2 text-right space-x-2">
                          <button onClick={() => openOverride({ id: row.staffId, name: row.staff.name || row.staff.email, email: row.staff.email })} className="text-xs text-blue-600 hover:underline">Override</button>
                          <button onClick={() => calculateResult(row.id)} className="text-xs text-slate-700 hover:underline" disabled={saving}>Recalculate</button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm"><p className="text-xs text-slate-500">Team Lead Contact Rate</p><p className="font-semibold text-slate-900">{summary.teamLeadContactRate}%</p></div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm"><p className="text-xs text-slate-500">Team Conversion Rate</p><p className="font-semibold text-slate-900">{summary.teamConversionRate}%</p></div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm"><p className="text-xs text-slate-500">Team Enrollments</p><p className="font-semibold text-slate-900">{summary.teamEnrollments}</p></div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm"><p className="text-xs text-slate-500">Team Achievement</p><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${achievementClass(summary.teamAchievement)}`}>{summary.teamAchievement}%</span></div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-2 py-2">Counsellor</th>
                  <th className="px-2 py-2">Leads Contacted</th>
                  <th className="px-2 py-2">Conversion Rate</th>
                  <th className="px-2 py-2">Offers</th>
                  <th className="px-2 py-2">Deposits</th>
                  <th className="px-2 py-2">Visas</th>
                  <th className="px-2 py-2">Enrolled</th>
                  <th className="px-2 py-2">Achievement</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-2 py-5 text-slate-500">Loading...</td></tr>
                ) : results.length === 0 ? (
                  <tr><td colSpan={8} className="px-2 py-5 text-slate-500">No KPI results calculated yet.</td></tr>
                ) : results.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{row.staff.name || row.staff.email}</td>
                    <td className="px-2 py-2 text-slate-700">{row.actualLeadsContacted} / {row.kpiTarget.targetLeadsContacted}</td>
                    <td className="px-2 py-2 text-slate-700">{row.overallConversionRate.toFixed(2)}% / {row.kpiTarget.targetLeadToStudent}%</td>
                    <td className="px-2 py-2 text-slate-700">{row.actualStudentsWithOffer}</td>
                    <td className="px-2 py-2 text-slate-700">{row.actualDepositPaid}</td>
                    <td className="px-2 py-2 text-slate-700">{row.actualVisaApplied}</td>
                    <td className="px-2 py-2 text-slate-700">{row.actualEnrolled} / {row.kpiTarget.targetEnrollments}</td>
                    <td className="px-2 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${achievementClass(row.achievementPercentage)}`}>{row.achievementPercentage.toFixed(2)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && modalStaff && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Override KPI Target - {modalStaff.name}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.periodLabel} onChange={(e) => setForm((prev) => ({ ...prev, periodLabel: e.target.value }))} placeholder="Period label" />
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.period} onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value as TargetRow["period"] }))}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
                <option value="INTAKE_SEASON">Intake Season</option>
              </select>
              <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
              <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetLeadsContacted} onChange={(e) => setForm((prev) => ({ ...prev, targetLeadsContacted: Number(e.target.value) }))} placeholder="Leads Target" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetLeadToStudent} onChange={(e) => setForm((prev) => ({ ...prev, targetLeadToStudent: Number(e.target.value) }))} placeholder="Lead to Student %" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetStudentToOffer} onChange={(e) => setForm((prev) => ({ ...prev, targetStudentToOffer: Number(e.target.value) }))} placeholder="Student to Offer %" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetOfferToDeposit} onChange={(e) => setForm((prev) => ({ ...prev, targetOfferToDeposit: Number(e.target.value) }))} placeholder="Offer to Deposit %" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetDepositToVisa} onChange={(e) => setForm((prev) => ({ ...prev, targetDepositToVisa: Number(e.target.value) }))} placeholder="Deposit to Visa %" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetVisaToEnrolled} onChange={(e) => setForm((prev) => ({ ...prev, targetVisaToEnrolled: Number(e.target.value) }))} placeholder="Visa to Enrolled %" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetOverallConversion} onChange={(e) => setForm((prev) => ({ ...prev, targetOverallConversion: Number(e.target.value) }))} placeholder="Overall Conversion %" />
              <input type="number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.targetEnrollments} onChange={(e) => setForm((prev) => ({ ...prev, targetEnrollments: Number(e.target.value) }))} placeholder="Enrollments Target" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Cancel</button>
              <button onClick={saveOverride} disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
