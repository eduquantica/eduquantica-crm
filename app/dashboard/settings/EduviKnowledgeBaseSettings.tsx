"use client";

import { useEffect, useMemo, useState } from "react";

type KnowledgeRow = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  isActive: boolean;
  updatedAt: string;
};

type Draft = {
  id?: string;
  title: string;
  category: string;
  content: string;
  tags: string;
  isActive: boolean;
};

const CATEGORY_OPTIONS = [
  "General Information",
  "UK Universities",
  "US Universities",
  "Canada Universities",
  "Australia Universities",
  "Visa Information",
  "Finance and Fees",
  "Documents Required",
  "EduQuantica Services",
  "Custom",
];

const EMPTY_DRAFT: Draft = {
  title: "",
  category: "General Information",
  content: "",
  tags: "",
  isActive: true,
};

export default function EduviKnowledgeBaseSettings() {
  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<KnowledgeRow | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, KnowledgeRow[]>();
    for (const row of rows) {
      const existing = map.get(row.category) || [];
      existing.push(row);
      map.set(row.category, existing);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  async function loadRows() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/knowledge-base", { cache: "no-store" });
    const payload = (await response.json()) as { data?: KnowledgeRow[]; error?: string };

    if (!response.ok || !payload.data) {
      setError(payload.error || "Failed to load knowledge base");
      setLoading(false);
      return;
    }

    setRows(payload.data);
    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  function beginEdit(row: KnowledgeRow) {
    setEditing({
      id: row.id,
      title: row.title,
      category: row.category,
      content: row.content,
      tags: row.tags.join(", "),
      isActive: row.isActive,
    });
  }

  function resetForm() {
    setEditing(EMPTY_DRAFT);
  }

  async function saveArticle() {
    if (!editing.title.trim() || !editing.category.trim() || !editing.content.trim()) return;

    setSaving(true);
    setError(null);

    const payload = {
      title: editing.title.trim(),
      category: editing.category.trim(),
      content: editing.content.trim(),
      tags: editing.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      isActive: editing.isActive,
    };

    const response = await fetch(editing.id ? `/api/admin/knowledge-base/${editing.id}` : "/api/admin/knowledge-base", {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(json.error || "Failed to save article");
      setSaving(false);
      return;
    }

    setSaving(false);
    resetForm();
    await loadRows();
  }

  async function toggleActive(row: KnowledgeRow) {
    setSaving(true);
    await fetch(`/api/admin/knowledge-base/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    setSaving(false);
    await loadRows();
  }

  async function deactivate(row: KnowledgeRow) {
    setSaving(true);
    await fetch(`/api/admin/knowledge-base/${row.id}`, { method: "DELETE" });
    setSaving(false);
    await loadRows();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Add / Edit Article</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              value={editing.title}
              onChange={(event) => setEditing((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Article title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
            <select
              value={editing.category}
              onChange={(event) => setEditing((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Tags (comma-separated)</label>
          <input
            value={editing.tags}
            onChange={(event) => setEditing((current) => ({ ...current, tags: event.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="visa, uk, fees"
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Content</label>
          <textarea
            value={editing.content}
            onChange={(event) => setEditing((current) => ({ ...current, content: event.target.value }))}
            rows={6}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Knowledge article content"
          />
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={editing.isActive}
            onChange={(event) => setEditing((current) => ({ ...current, isActive: event.target.checked }))}
          />
          Active
        </label>

        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void saveArticle()}
            disabled={saving}
            className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : editing.id ? "Update Article" : "Add Article"}
          </button>
          <button type="button" onClick={resetForm} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">Knowledge Articles</div>

        {loading ? <p className="px-4 py-4 text-sm text-slate-500">Loading...</p> : null}

        {!loading && grouped.length === 0 ? <p className="px-4 py-4 text-sm text-slate-500">No articles found.</p> : null}

        {!loading ? (
          <div className="space-y-3 p-3">
            {grouped.map(([category, articles]) => (
              <div key={category} className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{category}</p>

                <div className="mt-2 space-y-2">
                  {articles.map((article) => (
                    <div key={article.id} className="rounded border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{article.title}</p>
                          <p className="mt-1 text-xs text-slate-500">Tags: {article.tags.join(", ") || "—"}</p>
                          <p className="text-xs text-slate-500">Updated: {new Date(article.updatedAt).toLocaleString()}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${article.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {article.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => beginEdit(article)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Edit</button>
                        <button type="button" onClick={() => setPreview(article)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Preview</button>
                        <button type="button" onClick={() => void toggleActive(article)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">
                          {article.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" onClick={() => void deactivate(article)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700">Deactivate (Delete)</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Preview: {preview.title}</h4>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-blue-700">Close</button>
          </div>
          <p className="mt-2 text-xs text-slate-600">Category: {preview.category}</p>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-xs text-slate-700">{preview.content}</pre>
        </div>
      ) : null}
    </div>
  );
}
