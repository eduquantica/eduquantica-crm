"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type UcasCurrent = {
  academicYear: string;
  effectiveFrom: string;
  singleAmount: number;
  multipleAmount: number;
  currency: string;
};

type UcasHistoryRow = {
  academicYear: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  singleAmount: number | null;
  multipleAmount: number | null;
  createdAt: string;
};

type UniversityRow = {
  id: string;
  name: string;
  country: string;
  applicationFee: number | null;
  lastUpdatedAt: string | null;
};

type Payload = {
  ucasCurrent: UcasCurrent;
  ucasHistory: UcasHistoryRow[];
  universities: UniversityRow[];
};

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function ApplicationFeeManagementSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);

  const [academicYear, setAcademicYear] = useState("");
  const [singleAmount, setSingleAmount] = useState(0);
  const [multipleAmount, setMultipleAmount] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const [selectedUniversityIds, setSelectedUniversityIds] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/application-fees", { cache: "no-store" });
      const json = await res.json() as { data?: Payload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to load application fee settings");

      setPayload(json.data);
      setAcademicYear(json.data.ucasCurrent.academicYear);
      setSingleAmount(json.data.ucasCurrent.singleAmount);
      setMultipleAmount(json.data.ucasCurrent.multipleAmount);
      setEffectiveFrom(dateInputValue(json.data.ucasCurrent.effectiveFrom));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load application fee settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveUcas() {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/settings/application-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateUcas",
          academicYear,
          singleAmount,
          multipleAmount,
          effectiveFrom,
          currency: "GBP",
        }),
      });
      const json = await res.json() as { data?: Payload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to save UCAS configuration");

      setPayload(json.data);
      toast.success("UCAS fee configuration saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save UCAS configuration");
    } finally {
      setSaving(false);
    }
  }

  async function saveUniversityRows(rows: Array<{ universityId: string; amount: number }>) {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/settings/application-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateUniversityFees",
          updates: rows,
          effectiveFrom: new Date().toISOString(),
          currency: "GBP",
        }),
      });
      const json = await res.json() as { data?: Payload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to save university fees");
      setPayload(json.data);
      setSelectedUniversityIds(new Set());
      toast.success("University application fees updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save university fees");
    } finally {
      setSaving(false);
    }
  }

  const selectedUniversities = useMemo(
    () => (payload?.universities || []).filter((item) => selectedUniversityIds.has(item.id)),
    [payload?.universities, selectedUniversityIds],
  );

  if (loading) {
    return <p className="text-sm text-slate-500">Loading application fee settings...</p>;
  }

  if (!payload) {
    return <p className="text-sm text-rose-600">Failed to load application fee settings.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">UCAS Fee Configuration</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Single application fee (up to 5 universities)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">£{payload.ucasCurrent.singleAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Multiple application fee (beyond 5 universities)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">£{payload.ucasCurrent.multipleAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Academic year</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{payload.ucasCurrent.academicYear}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Effective from</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{new Date(payload.ucasCurrent.effectiveFrom).toLocaleDateString("en-GB")}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="Academic year (e.g. 2025-2026)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={singleAmount}
            onChange={(e) => setSingleAmount(Number(e.target.value || 0))}
            placeholder="Single fee"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={multipleAmount}
            onChange={(e) => setMultipleAmount(Number(e.target.value || 0))}
            placeholder="Multiple fee"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => void saveUcas()}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save UCAS Fees"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Academic Year</th>
                <th className="px-3 py-2 text-left font-medium">Single Fee</th>
                <th className="px-3 py-2 text-left font-medium">Multiple Fee</th>
                <th className="px-3 py-2 text-left font-medium">Effective From</th>
                <th className="px-3 py-2 text-left font-medium">Effective To</th>
              </tr>
            </thead>
            <tbody>
              {payload.ucasHistory.map((row) => (
                <tr key={`${row.academicYear}-${row.effectiveFrom}`} className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700">{row.academicYear}</td>
                  <td className="px-3 py-2 text-slate-700">{row.singleAmount != null ? `£${row.singleAmount.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.multipleAmount != null ? `£${row.multipleAmount.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{new Date(row.effectiveFrom).toLocaleDateString("en-GB")}</td>
                  <td className="px-3 py-2 text-slate-700">{row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString("en-GB") : "-"}</td>
                </tr>
              ))}
              {payload.ucasHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No UCAS fee history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">University Direct Fee Management</h3>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(Number(e.target.value || 0))}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Bulk amount"
          />
          <button
            type="button"
            disabled={saving || selectedUniversities.length === 0}
            onClick={() => void saveUniversityRows(selectedUniversities.map((row) => ({ universityId: row.id, amount: bulkAmount })))}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Apply Bulk Update ({selectedUniversities.length})
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Select</th>
                <th className="px-3 py-2 text-left font-medium">University</th>
                <th className="px-3 py-2 text-left font-medium">Country</th>
                <th className="px-3 py-2 text-left font-medium">Application Fee</th>
                <th className="px-3 py-2 text-left font-medium">Last Updated</th>
                <th className="px-3 py-2 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {payload.universities.map((row) => (
                <UniversityFeeRow
                  key={row.id}
                  row={row}
                  selected={selectedUniversityIds.has(row.id)}
                  onSelect={(selected) => {
                    setSelectedUniversityIds((prev) => {
                      const next = new Set(prev);
                      if (selected) next.add(row.id);
                      else next.delete(row.id);
                      return next;
                    });
                  }}
                  saving={saving}
                  onSave={(amount) => saveUniversityRows([{ universityId: row.id, amount }])}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UniversityFeeRow({
  row,
  selected,
  onSelect,
  saving,
  onSave,
}: {
  row: UniversityRow;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  saving: boolean;
  onSave: (amount: number) => Promise<void> | void;
}) {
  const [amount, setAmount] = useState<number>(row.applicationFee || 0);

  useEffect(() => {
    setAmount(row.applicationFee || 0);
  }, [row.applicationFee]);

  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
      </td>
      <td className="px-3 py-2 text-slate-700">{row.name}</td>
      <td className="px-3 py-2 text-slate-700">{row.country}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value || 0))}
          className="w-32 rounded-lg border border-slate-300 px-2 py-1.5"
        />
      </td>
      <td className="px-3 py-2 text-slate-500">{row.lastUpdatedAt ? new Date(row.lastUpdatedAt).toLocaleDateString("en-GB") : "-"}</td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave(amount)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
