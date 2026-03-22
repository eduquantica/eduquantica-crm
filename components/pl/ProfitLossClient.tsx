"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Office = {
  id: string;
  officeName?: string;
  name?: string;
  country: string;
  currency: string;
  city?: string | null;
  _count?: { incomes: number; expenses: number };
};

type SummaryData = {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    margin: number;
  };
  monthlyTrend: Array<{ month: number; label: string; income: number; expenses: number; profit: number }>;
  incomeByCountry: Array<{ country: string; amount: number }>;
  expenseByCategory: Array<{ category: string; amount: number }>;
};

type DynamicRow = { label: string; amount: number };

type IncomeSourceRow = {
  key: string;
  label: string;
  autoAmount: number;
  overrideAmount: number | null;
  finalAmount: number;
};

type IncomeData = {
  sourceRows: IncomeSourceRow[];
  totals: { autoTotal: number; finalTotal: number };
  counts: { paidInvoices: number; paidCommissions: number };
  hasAutoData: boolean;
  displayCurrency: string;
};

type ExpenseForm = {
  officeId: string;
  month: number;
  year: number;
  rent: number;
  salaries: number;
  marketing: number;
  operations: number;
  legal: number;
  travel: number;
  otherExpenses: DynamicRow[];
};

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
}

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Export failed");
  }
  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(objectUrl);
}

export default function ProfitLossClient({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [displayCurrency, setDisplayCurrency] = useState<string>("GBP");
  const [officeId, setOfficeId] = useState<string>("");
  const [tab, setTab] = useState<"summary" | "countries" | "offices" | "income" | "expenses">("summary");

  const [offices, setOffices] = useState<Office[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [incomeData, setIncomeData] = useState<IncomeData | null>(null);
  const [incomeOverrides, setIncomeOverrides] = useState<Record<string, string>>({});
  const [expenseRows, setExpenseRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [officeForm, setOfficeForm] = useState({ officeName: "", country: "", currency: "GBP", city: "" });
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    officeId: "",
    month,
    year,
    rent: 0,
    salaries: 0,
    marketing: 0,
    operations: 0,
    legal: 0,
    travel: 0,
    otherExpenses: [],
  });

  const countries = useMemo(() => {
    const map = new Map<string, { country: string; currency: string; offices: number }>();
    for (const office of offices) {
      const key = office.country;
      if (!map.has(key)) {
        map.set(key, { country: office.country, currency: office.currency, offices: 0 });
      }
      const row = map.get(key);
      if (row) row.offices += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country));
  }, [offices]);

  async function load() {
    setError(null);
    try {
      const q = `year=${year}&month=${month}${officeId ? `&officeId=${encodeURIComponent(officeId)}` : ""}`;
      const incomeQ = `${q}&currency=${encodeURIComponent(displayCurrency)}`;
      const [officesRes, summaryRes, incomeRes, expenseRes] = await Promise.all([
        fetch("/api/pl/offices", { cache: "no-store" }),
        fetch(`/api/pl/summary?${q}`, { cache: "no-store" }),
        fetch(`/api/pl/income?${incomeQ}`, { cache: "no-store" }),
        fetch(`/api/pl/expenses?${q}`, { cache: "no-store" }),
      ]);
      const [officesJson, summaryJson, incomeJson, expenseJson] = await Promise.all([
        officesRes.json(),
        summaryRes.json(),
        incomeRes.json(),
        expenseRes.json(),
      ]);
      if (!officesRes.ok || !summaryRes.ok || !incomeRes.ok || !expenseRes.ok) {
        throw new Error(summaryJson.error || incomeJson.error || expenseJson.error || "Failed to load P&L");
      }
      setOffices(officesJson.data || []);
      setSummary(summaryJson.data || null);
      const nextIncomeData = (incomeJson.data || null) as IncomeData | null;
      setIncomeData(nextIncomeData);
      if (nextIncomeData) {
        const nextOverrides: Record<string, string> = {};
        for (const row of nextIncomeData.sourceRows) {
          nextOverrides[row.key] = row.overrideAmount === null ? "" : String(row.overrideAmount);
        }
        setIncomeOverrides(nextOverrides);
      } else {
        setIncomeOverrides({});
      }
      setExpenseRows(expenseJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load P&L data");
    }
  }

  useEffect(() => {
    load();
  }, [year, month, officeId, displayCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setExpenseForm((prev) => ({ ...prev, month, year }));
  }, [month, year]);

  async function saveIncome(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;

    const overrides: Record<string, number> = {};
    for (const row of incomeData?.sourceRows || []) {
      const rawValue = (incomeOverrides[row.key] || "").trim();
      if (!rawValue) continue;
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed) && parsed >= 0) {
        overrides[row.key] = Number(parsed.toFixed(2));
      }
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        month,
        year,
        officeId: officeId || null,
        overrides,
      };
      const res = await fetch("/api/pl/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save income statement");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save income statement");
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...expenseForm,
        officeId: expenseForm.officeId || officeId || null,
      };
      const res = await fetch("/api/pl/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save expenses statement");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expenses statement");
    } finally {
      setSaving(false);
    }
  }

  async function createOffice(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pl/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(officeForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create office");
      setOfficeForm({ officeName: "", country: "", currency: "GBP", city: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create office");
    } finally {
      setSaving(false);
    }
  }

  const tabs = isAdmin
    ? ["summary", "countries", "offices", "income", "expenses"]
    : ["summary", "income", "expenses"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profit & Loss</h1>
          <p className="text-sm text-slate-600">Monthly statement management and profitability tracking.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {Array.from({ length: 6 }).map((_, i) => {
              const y = now.getUTCFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(Date.UTC(2024, i, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}</option>
            ))}
          </select>
          <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm min-w-44">
            <option value="">All Offices</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>{office.officeName || office.name} ({office.country})</option>
            ))}
          </select>
          <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {Array.from(new Set(["GBP", "BDT", "USD", "EUR", ...offices.map((office) => office.currency)])).map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
          <button onClick={() => downloadFile(`/api/pl/export?format=csv&year=${year}&month=${month}${officeId ? `&officeId=${officeId}` : ""}`, `pl-${year}-${month}.csv`)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Export CSV</button>
          <button onClick={() => downloadFile(`/api/pl/export?format=pdf&year=${year}&month=${month}${officeId ? `&officeId=${officeId}` : ""}`, `pl-${year}-${month}.pdf`)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Export PDF</button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item as typeof tab)}
            className={`rounded-md px-3 py-2 text-sm capitalize ${tab === item ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card title="Total Income" value={money(summary.summary.totalIncome)} />
          <Card title="Total Expenses" value={money(summary.summary.totalExpenses)} />
          <Card title="Net Profit" value={money(summary.summary.netProfit)} />
          <Card title="Margin" value={`${summary.summary.margin.toFixed(2)}%`} />
        </div>
      )}

      {tab === "summary" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Monthly Overview</h2>
            <div className="mt-3 space-y-2 text-sm">
              {(summary?.monthlyTrend || []).map((row) => (
                <div key={row.month} className="flex items-center justify-between border-b border-slate-100 py-1.5">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="text-slate-900">{money(row.profit)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Income by Country</h2>
            <div className="mt-3 space-y-2 text-sm">
              {(summary?.incomeByCountry || []).map((row) => (
                <div key={row.country} className="flex items-center justify-between border-b border-slate-100 py-1.5">
                  <span className="text-slate-600">{row.country}</span>
                  <span className="text-slate-900">{money(row.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {isAdmin && tab === "countries" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Countries</h2>
          <p className="mt-1 text-xs text-slate-500">Countries and currencies are derived from offices in this version.</p>
          <div className="mt-3 space-y-2">
            {countries.map((row) => (
              <div key={row.country} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span>{row.country}</span>
                <span className="text-slate-600">{row.currency} • {row.offices} offices</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && tab === "offices" && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Office Management</h2>
          <form onSubmit={createOffice} className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input value={officeForm.officeName} onChange={(e) => setOfficeForm((p) => ({ ...p, officeName: e.target.value }))} placeholder="Office Name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input value={officeForm.country} onChange={(e) => setOfficeForm((p) => ({ ...p, country: e.target.value }))} placeholder="Country" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input value={officeForm.currency} onChange={(e) => setOfficeForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} placeholder="Currency" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <button disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "Saving..." : "Add Office"}</button>
          </form>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-2 py-2">Office</th>
                  <th className="px-2 py-2">Country</th>
                  <th className="px-2 py-2">Currency</th>
                  <th className="px-2 py-2">Income Rows</th>
                  <th className="px-2 py-2">Expense Rows</th>
                </tr>
              </thead>
              <tbody>
                {offices.map((office) => (
                  <tr key={office.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-900">{office.officeName || office.name}</td>
                    <td className="px-2 py-2 text-slate-700">{office.country}</td>
                    <td className="px-2 py-2 text-slate-700">{office.currency}</td>
                    <td className="px-2 py-2 text-slate-700">{office._count?.incomes ?? 0}</td>
                    <td className="px-2 py-2 text-slate-700">{office._count?.expenses ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "income" && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Income Statement</h2>
          {!incomeData || (incomeData.sourceRows.every((row) => row.autoAmount === 0 && row.overrideAmount === null) && !incomeData.hasAutoData) ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No records found for this period.
            </div>
          ) : (
            <form onSubmit={saveIncome} className="space-y-3">
              <div className="space-y-2">
                {incomeData.sourceRows.map((row) => {
                  const inputValue = incomeOverrides[row.key] ?? "";
                  const hasOverride = inputValue.trim() !== "";
                  const parsedOverride = Number(inputValue);
                  const effective = hasOverride && Number.isFinite(parsedOverride) && parsedOverride >= 0
                    ? parsedOverride
                    : row.autoAmount;

                  return (
                    <div key={row.key} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{row.label}</p>
                          <p className="text-xs text-slate-500">Auto from CRM: {money(row.autoAmount, incomeData.displayCurrency)}</p>
                        </div>
                        {isAdmin ? (
                          <div className="grid w-full gap-2 md:w-[380px] md:grid-cols-[1fr_1fr]">
                            <label className="text-xs text-slate-600">
                              Override
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="Use auto"
                                value={inputValue}
                                onChange={(e) => setIncomeOverrides((prev) => ({ ...prev, [row.key]: e.target.value }))}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <div className="text-xs text-slate-600">
                              Final
                              <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                                {money(effective, incomeData.displayCurrency)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">Amount: {money(row.finalAmount, incomeData.displayCurrency)}</p>
                            <p className="text-xs text-slate-500">Calculated from your records</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Auto Total</span>
                  <span className="font-medium text-slate-900">{money(incomeData.totals.autoTotal, incomeData.displayCurrency)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Final Total</span>
                  <span className="font-semibold text-slate-900">
                    {money(
                      incomeData.sourceRows.reduce((sum, row) => {
                        const raw = (incomeOverrides[row.key] || "").trim();
                        const parsed = Number(raw);
                        const value = raw && Number.isFinite(parsed) && parsed >= 0 ? parsed : row.autoAmount;
                        return sum + value;
                      }, 0),
                      incomeData.displayCurrency,
                    )}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Saving..." : "Save Income Overrides"}
                </button>
              )}
            </form>
          )}
        </section>
      )}

      {tab === "expenses" && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Expense Statement</h2>
          <form onSubmit={saveExpense} className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <select value={expenseForm.officeId} onChange={(e) => setExpenseForm((p) => ({ ...p, officeId: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select Office</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>{office.officeName || office.name}</option>
              ))}
            </select>
            <NumberField label="Rent" value={expenseForm.rent} onChange={(value) => setExpenseForm((p) => ({ ...p, rent: value }))} />
            <NumberField label="Salaries" value={expenseForm.salaries} onChange={(value) => setExpenseForm((p) => ({ ...p, salaries: value }))} />
            <NumberField label="Marketing" value={expenseForm.marketing} onChange={(value) => setExpenseForm((p) => ({ ...p, marketing: value }))} />
            <NumberField label="Operations" value={expenseForm.operations} onChange={(value) => setExpenseForm((p) => ({ ...p, operations: value }))} />
            <NumberField label="Legal" value={expenseForm.legal} onChange={(value) => setExpenseForm((p) => ({ ...p, legal: value }))} />
            <NumberField label="Travel" value={expenseForm.travel} onChange={(value) => setExpenseForm((p) => ({ ...p, travel: value }))} />
            <button disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "Saving..." : "Save Monthly Expenses"}</button>
          </form>
          <SimpleJsonRows rows={expenseForm.otherExpenses} onChange={(rows) => setExpenseForm((p) => ({ ...p, otherExpenses: rows }))} title="Other Expenses" />
          <DataRows title="Stored Expense Statements" rows={expenseRows} />
        </section>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-600">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-slate-600">
      {label}
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function SimpleJsonRows({ title, rows, onChange }: { title: string; rows: DynamicRow[]; onChange: (rows: DynamicRow[]) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...rows, { label: "", amount: 0 }])}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          Add
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={`${row.label}-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_90px]">
            <input
              value={row.label}
              onChange={(e) => onChange(rows.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))}
              placeholder="Label"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={row.amount}
              onChange={(e) => onChange(rows.map((item, i) => (i === idx ? { ...item, amount: Number(e.target.value) || 0 } : item)))}
              placeholder="Amount"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-slate-500">No rows added.</p>}
      </div>
    </div>
  );
}

function DataRows({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <pre className="mt-2 max-h-56 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">{JSON.stringify(rows, null, 2)}</pre>
    </div>
  );
}
