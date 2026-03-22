"use client";

import { useEffect, useMemo, useState } from "react";

type Tier = "GOLD" | "SILVER" | "PLATINUM";
type MaterialType = "BROCHURE_PDF" | "SOCIAL_MEDIA_POST" | "EMAIL_TEMPLATE" | "UNIVERSITY_FLYER" | "BANNER_AD" | "PRESENTATION";

interface MaterialRow {
  id: string;
  name: string;
  type: MaterialType;
  fileUrl: string;
  thumbnailUrl: string | null;
  availableTiers: Tier[];
  linkedUniversityId: string | null;
  linkedUniversity?: { name: string } | null;
  isActive: boolean;
}

interface UniversityOption {
  id: string;
  name: string;
}

const DEFAULT_FORM = {
  name: "",
  type: "BROCHURE_PDF" as MaterialType,
  fileUrl: "",
  thumbnailUrl: "",
  linkedUniversityId: "",
  isActive: true,
  availableTiers: ["GOLD", "SILVER", "PLATINUM"] as Tier[],
};

export default function WhiteLabelClient() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | MaterialType>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");
  const [universityFilter, setUniversityFilter] = useState<string>("ALL");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const typeOptions: Array<"ALL" | MaterialType> = [
    "ALL",
    "BROCHURE_PDF",
    "SOCIAL_MEDIA_POST",
    "EMAIL_TEMPLATE",
    "UNIVERSITY_FLYER",
    "BANNER_AD",
    "PRESENTATION",
  ];
  const tierOptions: Array<"ALL" | Tier> = ["ALL", "GOLD", "SILVER", "PLATINUM"];

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/white-label");
      if (!res.ok) return;
      const json = await res.json();
      setMaterials(json.data.materials || []);
      setUniversities(json.data.universities || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return materials.filter((item) => {
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (tierFilter !== "ALL" && !item.availableTiers.includes(tierFilter)) return false;
      if (universityFilter !== "ALL" && (item.linkedUniversityId || "") !== universityFilter) return false;
      return true;
    });
  }, [materials, statusFilter, typeFilter, tierFilter, universityFilter]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      linkedUniversityId: form.linkedUniversityId || null,
      thumbnailUrl: form.thumbnailUrl || undefined,
    };

    const res = await fetch(editingId ? `/api/admin/white-label/${editingId}` : "/api/admin/white-label", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Could not save material");
      return;
    }

    await load();
    resetForm();
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Delete this material?");
    if (!ok) return;
    const res = await fetch(`/api/admin/white-label/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }
    await load();
  }

  function startEdit(item: MaterialRow) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      fileUrl: item.fileUrl,
      thumbnailUrl: item.thumbnailUrl || "",
      linkedUniversityId: item.linkedUniversityId || "",
      isActive: item.isActive,
      availableTiers: item.availableTiers as Tier[],
    });
  }

  async function uploadFile(file: File, target: "file" | "thumb") {
    const body = new FormData();
    body.append("files", file);
    body.append("preserveOriginal", "true");
    setUploading(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json() as { urls?: string[]; error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.error || "Upload failed");
      }
      const url = json.urls?.[0];
      if (!url) {
        throw new Error("Upload failed");
      }
      setForm((prev) => ({ ...prev, fileUrl: target === "file" ? url : prev.fileUrl, thumbnailUrl: target === "thumb" ? url : prev.thumbnailUrl }));
      if (json.message) {
        alert(json.message);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">White Label Marketing</h1>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Edit Material" : "Add Material"}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded-md px-3 py-2" placeholder="Material name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <select className="border rounded-md px-3 py-2" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as MaterialType }))}>
            <option value="BROCHURE_PDF">Brochure PDF</option>
            <option value="SOCIAL_MEDIA_POST">Social Media Post</option>
            <option value="EMAIL_TEMPLATE">Email Template</option>
            <option value="UNIVERSITY_FLYER">University Flyer</option>
            <option value="BANNER_AD">Banner Ad</option>
            <option value="PRESENTATION">Presentation</option>
          </select>
          <input className="border rounded-md px-3 py-2" placeholder="File URL" value={form.fileUrl} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} required />
          <input className="border rounded-md px-3 py-2" placeholder="Thumbnail URL (optional)" value={form.thumbnailUrl} onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))} />
          <select className="border rounded-md px-3 py-2" value={form.linkedUniversityId} onChange={(e) => setForm((p) => ({ ...p, linkedUniversityId: e.target.value }))}>
            <option value="">No linked university</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">
            Upload source file
            <input type="file" className="block mt-1" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "file")} />
          </label>
          <label className="text-sm text-slate-700">
            Upload thumbnail
            <input type="file" className="block mt-1" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "thumb")} />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          {(["GOLD", "SILVER", "PLATINUM"] as Tier[]).map((tier) => (
            <label key={tier} className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.availableTiers.includes(tier)}
                onChange={(e) => {
                  setForm((prev) => {
                    const next = e.target.checked
                      ? [...prev.availableTiers, tier]
                      : prev.availableTiers.filter((t) => t !== tier);
                    return { ...prev, availableTiers: next.length ? next : prev.availableTiers };
                  });
                }}
              />
              {tier}
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button disabled={uploading} className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50" type="submit">
            {editingId ? "Save Changes" : "Add Material"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border">Cancel</button>
          )}
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")} className="border rounded-md px-3 py-2 text-sm">
            <option value="ALL">Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "ALL" | MaterialType)} className="border rounded-md px-3 py-2 text-sm">
            {typeOptions.map((value) => (
              <option key={value} value={value}>
                {value === "ALL" ? "Type: All" : value}
              </option>
            ))}
          </select>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as "ALL" | Tier)} className="border rounded-md px-3 py-2 text-sm">
            {tierOptions.map((value) => (
              <option key={value} value={value}>
                {value === "ALL" ? "Tier: All" : value}
              </option>
            ))}
          </select>
          <select value={universityFilter} onChange={(e) => setUniversityFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
            <option value="ALL">University: All</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Material</th>
                <th className="py-2">Type</th>
                <th className="py-2">Tier</th>
                <th className="py-2">University</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="py-3 text-slate-500" colSpan={6}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="py-3 text-slate-500" colSpan={6}>No materials found.</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <a href={item.fileUrl} target="_blank" className="text-blue-600 hover:underline text-xs" rel="noreferrer">Open file</a>
                    </td>
                    <td className="py-2">{item.type}</td>
                    <td className="py-2">{item.availableTiers.join(", ")}</td>
                    <td className="py-2">{item.linkedUniversity?.name || "—"}</td>
                    <td className="py-2">{item.isActive ? "Active" : "Inactive"}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(item)} className="px-2 py-1 border rounded">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="px-2 py-1 border rounded text-red-600">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
