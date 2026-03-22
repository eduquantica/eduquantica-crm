"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

const PAYMENT_TYPES = [
  { value: "BANK", label: "Bank Transfer" },
  { value: "E_BANKING", label: "E-Banking" },
  { value: "DIGITAL_WALLET", label: "Digital Wallet" },
  { value: "CASH", label: "Cash" },
  { value: "OTHER", label: "Other" },
];

export default function PaymentMethodsSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("BANK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payment-methods");
      if (!res.ok) throw new Error("Failed to fetch payment methods");
      const json = await res.json();
      setMethods(json.data || []);
      return json.data;
    },
  });

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Please enter a payment method name");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, type: formType }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create payment method");
      }

      const json = await res.json();
      setMethods([...methods, json.data]);
      setFormName("");
      setFormType("BANK");
      setShowForm(false);
      setMessage("Payment method added successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) throw new Error("Failed to update payment method");

      setMethods(
        methods.map((m) => (m.id === id ? { ...m, isActive: !currentActive } : m))
      );
      setMessage("Payment method updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment method?")) return;

    try {
      const res = await fetch(`/api/admin/payment-methods/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete payment method");

      setMethods(methods.filter((m) => m.id !== id));
      setMessage("Payment method deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payment Methods</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage available payment methods for student invoices.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Method
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAddMethod} className="mb-6 rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Payment Method Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Google Pay"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Type *
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
      ) : methods.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No payment methods yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr
                  key={method.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-900">{method.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">
                      {PAYMENT_TYPES.find((t) => t.value === method.type)
                        ?.label || method.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={method.isActive}
                        onChange={() =>
                          handleToggleActive(method.id, method.isActive)
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs text-slate-600">
                        {method.isActive ? "Active" : "Inactive"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteMethod(method.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
