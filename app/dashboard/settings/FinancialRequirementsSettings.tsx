"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Rule = {
  countryCode: string;
  countryName: string;
  monthlyLivingCost: number;
  currency: string;
  defaultMonths: number;
  rules: string[];
  lastUpdated?: string | null;
};

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
    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/financial-requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save financial requirements");
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
              <th className="px-3 py-2 text-left font-medium">Country</th>
              <th className="px-3 py-2 text-left font-medium">Monthly Living Cost</th>
              <th className="px-3 py-2 text-left font-medium">Annual Living Cost</th>
              <th className="px-3 py-2 text-left font-medium">Currency</th>
              <th className="px-3 py-2 text-left font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, idx) => (
              <tr key={rule.countryCode} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2">
                  <input
                    value={rule.countryName}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, countryName: e.target.value } : r)))
                    }
                    className="w-44 rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={rule.monthlyLivingCost}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, monthlyLivingCost: Number(e.target.value || 0) } : r)))
                    }
                    className="w-36 rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={rule.monthlyLivingCost * 12}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, monthlyLivingCost: Number(e.target.value || 0) / 12 } : r)))
                    }
                    className="w-36 rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={rule.currency}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, currency: e.target.value.toUpperCase() } : r)))
                    }
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
                    maxLength={3}
                  />
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {rule.lastUpdated ? new Date(rule.lastUpdated).toLocaleDateString("en-GB") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rules.map((rule, idx) => (
        <div key={`${rule.countryCode}-rules`} className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">{rule.countryName} visa rules</p>
          <textarea
            rows={3}
            value={rule.rules.join("\n")}
            onChange={(e) =>
              setRules((prev) =>
                prev.map((r, i) =>
                  i === idx
                    ? {
                        ...r,
                        rules: e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      }
                    : r,
                ),
              )
            }
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      ))}

      <div>
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
