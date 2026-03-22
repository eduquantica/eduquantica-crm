"use client";

import { useEffect, useState } from "react";

type BrandingData = {
  agencyName: string;
  brandingLogoUrl?: string | null;
  brandingPrimaryColor?: string | null;
  brandingContactEmail?: string | null;
  brandingContactPhone?: string | null;
  brandingWebsite?: string | null;
  brandingFacebook?: string | null;
  brandingInstagram?: string | null;
  brandingLinkedIn?: string | null;
  brandingWhatsapp?: string | null;
  referralCode?: string | null;
  _count: { referredStudents: number };
};

export default function AgentBrandingClient() {
  const [form, setForm] = useState<BrandingData | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  async function load() {
    const res = await fetch("/api/agent/profile/branding");
    if (!res.ok) return;
    const json = await res.json();
    setForm(json.data);
  }

  useEffect(() => {
    load();
    setOrigin(window.location.origin);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agent/profile/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        alert("Failed to save branding settings");
        return;
      }
      await load();
      alert("Branding updated");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    const body = new FormData();
    body.append("files", file);
    body.append("preserveOriginal", "true");
    const res = await fetch("/api/upload", { method: "POST", body });
    const json = await res.json() as { urls?: string[]; error?: string; message?: string };
    if (!res.ok) {
      alert(json.error || "Upload failed");
      return;
    }
    const url = json.urls?.[0];
    if (!url) {
      alert("Upload failed");
      return;
    }
    setForm((prev) => (prev ? { ...prev, brandingLogoUrl: url } : prev));
    if (json.message) {
      alert(json.message);
    }
  }

  if (!form) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Loading branding...</div>;
  }

  const referralLink = `${origin}/register?ref=${form.referralCode || ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Branding Settings</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm text-slate-700">Referral link</div>
        <div className="mt-1 text-sm text-slate-900 break-all">{referralLink}</div>
        <div className="mt-1 text-xs text-slate-500">Referred students: {form._count.referredStudents}</div>
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded-md px-3 py-2" placeholder="Agency name" value={form.agencyName || ""} onChange={(e) => setForm((p) => (p ? { ...p, agencyName: e.target.value } : p))} required />
          <input type="color" className="h-10 border rounded-md px-2" value={form.brandingPrimaryColor || "#1E3A5F"} onChange={(e) => setForm((p) => (p ? { ...p, brandingPrimaryColor: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="Contact email" value={form.brandingContactEmail || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingContactEmail: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="Contact phone" value={form.brandingContactPhone || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingContactPhone: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="Website" value={form.brandingWebsite || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingWebsite: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="Logo URL" value={form.brandingLogoUrl || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingLogoUrl: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="Facebook" value={form.brandingFacebook || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingFacebook: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="Instagram" value={form.brandingInstagram || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingInstagram: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="LinkedIn" value={form.brandingLinkedIn || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingLinkedIn: e.target.value } : p))} />
          <input className="border rounded-md px-3 py-2" placeholder="WhatsApp" value={form.brandingWhatsapp || ""} onChange={(e) => setForm((p) => (p ? { ...p, brandingWhatsapp: e.target.value } : p))} />
        </div>

        <label className="text-sm text-slate-700 block">
          Upload logo
          <input type="file" className="block mt-1" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </label>

        <button disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50">Save Branding</button>
      </form>
    </div>
  );
}
