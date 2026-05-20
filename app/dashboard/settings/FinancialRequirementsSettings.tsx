"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  countryCode: string;
  countryName: string;
  monthlyLivingCost: number;
  currency: string;
  defaultMonths: number;
  rules: string[];
  lastUpdated?: string | null;
  isNew?: boolean;
};

function emptyCountry(): Rule {
  return {
    countryCode: "",
    countryName: "",
    monthlyLivingCost: 0,
    currency: "",
    defaultMonths: 12,
    rules: [],
    lastUpdated: null,
    isNew: true,
  };
}

export default function FinancialRequirementsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings/financial-requirements", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load financial requirements");
        if (mounted) setRules((json.data?.rules || []) as Rule[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load financial requirements");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, []);

  function addCountry() {
    setRules((prev) => [...prev, emptyCountry()]);
  }

  function removeCountry(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }

  function update<K extends keyof Rule>(idx: number, key: K, value: Rule[K]) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  async function save() {
    const invalid = rules.find((r) => !r.countryCode.trim() || r.countryCode.trim().length < 2);
    if (invalid) {
      toast.error(`Country code is required (min 2 chars) — check "${invalid.countryName || "new entry"}"`);
      return;
    }
    const invalidName = rules.find((r) => !r.countryName.trim() || r.countryName.trim().length < 2);
    if (invalidName) {
      toast.error("Country name is required (min 2 chars)");
      return;
    }
    const invalidCurrency = rules.find((r) => r.currency.trim().length !== 3);
    if (invalidCurrency) {
      toast.error(`Currency must be exactly 3 characters — check "${invalidCurrency.countryName}"`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/financial-requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save financial requirements");
      // Clear isNew flag after save
      setRules((prev) => prev.map((r) => ({ ...r, isNew: false })));
      toast.success("Financial requirements updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save financial requirements");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading financial requirements...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Code</th>
              <th className="px-3 py-2 text-left font-medium">Country</th>
              <th className="px-3 py-2 text-left font-medium">Monthly Living Cost</th>
              <th className="px-3 py-2 text-left font-medium">Months</th>
              <th className="px-3 py-2 text-left font-medium">Annual Living Cost</th>
              <th className="px-3 py-2 text-left font-medium">Currency</th>
              <th className="px-3 py-2 text-left font-medium">Last Updated</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, idx) => (
              <tr
                key={`${rule.countryCode || "new"}-${idx}`}
                className={`border-t border-slate-200 align-top ${rule.isNew ? "bg-blue-50/40" : ""}`}
              >
                {/* Country Code */}
                <td className="px-3 py-2">
                  <input
                    value={rule.countryCode}
                    onChange={(e) => update(idx, "countryCode", e.target.value.toUpperCase())}
                    placeholder="e.g. SG"
                    maxLength={5}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 font-mono uppercase"
                  />
                </td>
                {/* Country Name */}
                <td className="px-3 py-2">
                  <input
                    value={rule.countryName}
                    onChange={(e) => update(idx, "countryName", e.target.value)}
                    placeholder="e.g. Singapore"
                    className="w-44 rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </td>
                {/* Monthly */}
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={rule.monthlyLivingCost}
                    onChange={(e) => update(idx, "monthlyLivingCost", Number(e.target.value || 0))}
                    className="w-32 rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </td>
                {/* Months */}
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={rule.defaultMonths}
                    onChange={(e) => update(idx, "defaultMonths", Math.max(1, Number(e.target.value || 1)))}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </td>
                {/* Annual (computed, read-only) */}
                <td className="px-3 py-2">
                  <div className="flex h-[34px] w-36 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-700">
                    {(rule.monthlyLivingCost * rule.defaultMonths).toLocaleString()}
                  </div>
                </td>
                {/* Currency */}
                <td className="px-3 py-2">
                  <input
                    value={rule.currency}
                    onChange={(e) => update(idx, "currency", e.target.value.toUpperCase())}
                    placeholder="GBP"
                    maxLength={3}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 font-mono uppercase"
                  />
                </td>
                {/* Last Updated */}
                <td className="px-3 py-2 text-slate-500">
                  {rule.lastUpdated ? new Date(rule.lastUpdated).toLocaleDateString("en-GB") : "—"}
                </td>
                {/* Remove */}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeCountry(idx)}
                    title="Remove country"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Country Button */}
      <button
        type="button"
        onClick={addCountry}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
      >
        <Plus size={15} />
        Add Country
      </button>

      {/* Visa Rules per Country */}
      {rules.map((rule, idx) => (
        <div key={`${rule.countryCode || "new"}-${idx}-rules`} className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {rule.countryName || "New Country"} visa rules
            <span className="ml-2 text-xs font-normal text-slate-400">(one rule per line)</span>
          </p>
          <textarea
            rows={3}
            value={rule.rules.join("\n")}
            onChange={(e) =>
              update(idx, "rules", e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))
            }
            placeholder="e.g. 28-day consecutive bank statement rule"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Financial Requirements"}
        </button>
      </div>
    </div>
  );
}
