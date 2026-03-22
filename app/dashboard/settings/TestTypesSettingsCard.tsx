"use client";

import { useEffect, useState } from "react";

type TestTypeRow = {
  id: string;
  name: string;
  isIELTS: boolean;
};

export default function TestTypesSettingsCard() {
  const [rows, setRows] = useState<TestTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIELTS, setNewIELTS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIELTS, setEditingIELTS] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-types", { cache: "no-store" });
      const json = await res.json() as { data?: TestTypeRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load test types");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test types");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createType() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), isIELTS: newIELTS }),
      });
      const json = await res.json() as { data?: TestTypeRow; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to create test type");
      setRows((prev) => [...prev, json.data as TestTypeRow].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewIELTS(false);
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test type");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editingId || !editingName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/test-types/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim(), isIELTS: editingIELTS }),
      });
      const json = await res.json() as { data?: TestTypeRow; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || "Failed to update test type");
      setRows((prev) => prev.map((row) => (row.id === editingId ? json.data as TestTypeRow : row)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setEditingName("");
      setEditingIELTS(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update test type");
    } finally {
      setSaving(false);
    }
  }

  async function deleteType(id: string) {
    const ok = window.confirm("Delete this test type?");
    if (!ok) return;
    setError(null);
    const res = await fetch(`/api/admin/test-types/${id}`, { method: "DELETE" });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setError(json.error || "Failed to delete test type");
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Test Types</h3>
        <button
          type="button"
          onClick={() => setShowAdd((prev) => !prev)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Add Test Type
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {showAdd && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Test Type Name"
              className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newIELTS}
                onChange={(event) => setNewIELTS(event.target.checked)}
              />
              Is IELTS
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void createType();
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading test types...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600">No test types found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Is IELTS</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    {editingId === row.id ? (
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === row.id ? (
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editingIELTS}
                          onChange={(event) => setEditingIELTS(event.target.checked)}
                        />
                        IELTS
                      </label>
                    ) : row.isIELTS ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === row.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            void saveEdit();
                          }}
                          className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                            setEditingIELTS(false);
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(row.id);
                            setEditingName(row.name);
                            setEditingIELTS(row.isIELTS);
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteType(row.id);
                          }}
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
