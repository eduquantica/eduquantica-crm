"use client";

import { useEffect, useState } from "react";

type DeclarationRow = {
  id: string;
  applicationId: string | null;
  declarationText: string;
  signatureName: string;
  signedAt: string;
  createdAt: string;
};

export default function StudentDeclarationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DeclarationRow[]>([]);
  const [defaultText, setDefaultText] = useState("");
  const [declarationText, setDeclarationText] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [applicationId, setApplicationId] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/declarations", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load declarations");
      setRows(json.data || []);
      setDefaultText(json.defaultDeclarationText || "");
      setDeclarationText((json.defaultDeclarationText || "").toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load declarations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/student/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: applicationId.trim() || null,
          declarationText: declarationText.trim() || defaultText,
          signatureName: signatureName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to sign declaration");
      setSignatureName("");
      setApplicationId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign declaration");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Student Declaration</h1>
        <p className="mt-1 text-sm text-slate-600">Sign your declaration and download signed PDF copies.</p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Sign New Declaration</h2>
        <form onSubmit={handleSign} className="mt-3 space-y-3">
          <input
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            placeholder="Application ID (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={declarationText}
            onChange={(e) => setDeclarationText(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Type your full name as signature"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Signing..." : "Sign Declaration"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Signed Declarations</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No declarations signed yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Signed At</th>
                  <th className="px-2 py-2">Signature</th>
                  <th className="px-2 py-2">Application</th>
                  <th className="px-2 py-2">PDF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-700">{new Date(row.signedAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-2 py-2 text-slate-700">{row.signatureName}</td>
                    <td className="px-2 py-2 text-slate-700">{row.applicationId || "-"}</td>
                    <td className="px-2 py-2">
                      <a href={`/api/student/declarations/${row.id}/pdf`} className="text-blue-600 hover:underline">
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
