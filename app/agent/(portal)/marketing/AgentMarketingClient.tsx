"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";

type Material = {
  id: string;
  name: string;
  type: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  linkedUniversity?: { name: string } | null;
};

type AgentData = {
  subAgent: {
    agencyName: string;
    brandingLogoUrl?: string | null;
    brandingPrimaryColor?: string | null;
    brandingContactEmail?: string | null;
    brandingContactPhone?: string | null;
    brandingWebsite?: string | null;
    _count: { referredStudents: number };
  };
  tierLabel: "GOLD" | "SILVER" | "PLATINUM";
  materials: Material[];
  referralLink: string;
};

export default function AgentMarketingClient() {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/marketing");
      if (!res.ok) return;
      const json = await res.json();
      setData(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function copyReferral() {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    alert("Referral link copied");
  }

  async function downloadBranded(material: Material) {
    const isPdf = material.fileUrl.toLowerCase().includes(".pdf");
    if (isPdf) {
      window.open(`/api/agent/marketing/${material.id}/brand-preview`, "_blank");
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = material.fileUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    const color = data?.subAgent.brandingPrimaryColor || "#1E3A5F";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, 80);
    ctx.fillStyle = "white";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(data?.subAgent.agencyName || "Agency", 20, 50);

    ctx.fillStyle = color;
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
    ctx.fillStyle = "white";
    ctx.font = "20px sans-serif";
    const footer = [data?.subAgent.brandingContactEmail, data?.subAgent.brandingContactPhone, data?.subAgent.brandingWebsite]
      .filter(Boolean)
      .join(" • ");
    ctx.fillText(footer || "", 20, canvas.height - 24);

    const link = document.createElement("a");
    link.download = `branded-${material.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Marketing Materials</h1>
        <div className="text-sm text-slate-600">Tier access: <span className="font-semibold">{data?.tierLabel || "—"}</span></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Referral Link</h2>
          <p className="text-sm text-slate-600 break-all">{data?.referralLink || "Loading..."}</p>
          <p className="text-xs text-slate-500 mt-1">Referred students: {data?.subAgent._count.referredStudents ?? 0}</p>
        </div>
        <button onClick={copyReferral} className="px-3 py-2 rounded-md bg-blue-600 text-white w-fit">Copy Link</button>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Loading...</div>
      ) : !data || data.materials.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">No materials available for your tier.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.materials.map((material) => (
            <div key={material.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {material.thumbnailUrl || material.fileUrl.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                  <NextImage
                    src={material.thumbnailUrl || material.fileUrl}
                    alt={material.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="text-sm text-slate-500">Preview unavailable</div>
                )}
              </div>
              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <div className="font-semibold text-slate-900">{material.name}</div>
                <div className="text-xs text-slate-600">{material.type}</div>
                <div className="text-xs text-slate-500">{material.linkedUniversity?.name || "General"}</div>
                <div className="pt-2 mt-auto flex gap-2">
                  <button onClick={() => setPreviewMaterial(material)} className="px-3 py-1.5 text-xs border rounded-md">Live Preview</button>
                  <button onClick={() => downloadBranded(material)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md">Download Branded</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewMaterial && data && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Live Preview: {previewMaterial.name}</h3>
              <button onClick={() => setPreviewMaterial(null)} className="text-sm border rounded px-2 py-1">Close</button>
            </div>

            {previewMaterial.fileUrl.toLowerCase().includes(".pdf") ? (
              <iframe src={`/api/agent/marketing/${previewMaterial.id}/brand-preview`} className="w-full h-[70vh] border rounded" />
            ) : (
              <div className="relative border rounded overflow-hidden">
                <NextImage
                  src={previewMaterial.fileUrl}
                  alt={previewMaterial.name}
                  width={1400}
                  height={900}
                  unoptimized
                  className="w-full h-auto"
                />
                <div className="absolute top-0 left-0 right-0 p-3 text-white font-semibold" style={{ backgroundColor: data.subAgent.brandingPrimaryColor || "#1E3A5F" }}>
                  {data.subAgent.agencyName}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs" style={{ backgroundColor: data.subAgent.brandingPrimaryColor || "#1E3A5F" }}>
                  {[data.subAgent.brandingContactEmail, data.subAgent.brandingContactPhone, data.subAgent.brandingWebsite].filter(Boolean).join(" • ")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
