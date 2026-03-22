"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import UniversityScrapeManager from "@/components/UniversityScrapeManager";

interface FormData {
  name: string;
  country: string;
  city: string;
  type: "PUBLIC" | "PRIVATE";
  qsRanking: string;
  timesHigherRanking: string;
  website: string;
  description: string;
  foundedYear: string;
  dliNumber: string;
  applicationFee: string;
  contactPerson: string;
  contactEmail: string;
  currency: string;
  logo: string;
  campusPhotos: string[];
  isActive: boolean;
  postStudyWorkVisa: string;
}

export default function AddUniversityPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const [uploadedPhotoPaths, setUploadedPhotoPaths] = useState<string[]>([]);

  const [form, setForm] = useState<FormData>({
    name: "",
    country: "",
    city: "",
    type: "PUBLIC",
    qsRanking: "",
    timesHigherRanking: "",
    website: "",
    description: "",
    foundedYear: "",
    dliNumber: "",
    applicationFee: "",
    contactPerson: "",
    contactEmail: "",
    currency: "GBP",
    logo: "",
    campusPhotos: [],
    isActive: true,
    postStudyWorkVisa: "",
  });

  const handleChange = (name: string, value: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleFileUpload = async (files: FileList | null, isCampus: boolean) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    formData.append("preserveOriginal", "true");

    try {
      setError("");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json() as { urls?: string[]; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const paths = data.urls || [];
      if (data.message) {
        setInfo(data.message);
      }

      if (isCampus) {
        setUploadedPhotoPaths((prev) => [...prev, ...paths]);
        setForm((f) => ({ ...f, campusPhotos: [...f.campusPhotos, ...paths] }));
      } else {
        if (paths.length > 0) {
          setForm((f) => ({ ...f, logo: paths[0] }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "File upload failed");
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotoPaths((prev) => prev.filter((_, i) => i !== index));
    setForm((f) => ({ ...f, campusPhotos: f.campusPhotos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!form.name || !form.country || !form.city) {
      setError("Please fill in required fields");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: form.name,
        country: form.country,
        city: form.city,
        type: form.type,
        qsRanking: form.qsRanking ? parseInt(form.qsRanking) : null,
        timesHigherRanking: form.timesHigherRanking ? parseInt(form.timesHigherRanking) : null,
        website: form.website || null,
        description: form.description || null,
        foundedYear: form.foundedYear ? parseInt(form.foundedYear) : null,
        dliNumber: form.dliNumber || null,
        applicationFee: form.applicationFee ? parseFloat(form.applicationFee) : null,
        contactPerson: form.contactPerson || null,
        contactEmail: form.contactEmail || null,
        currency: form.currency,
        logo: form.logo || null,
        campusPhotos: form.campusPhotos,
        isActive: form.isActive,
        postStudyWorkVisa: form.postStudyWorkVisa || null,
      };

      const res = await fetch("/api/admin/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create university");
      }

      const result = await res.json();
      router.push(`/dashboard/universities/${result.data.university.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencyOptions = ["GBP", "CAD", "AUD", "USD", "EUR", "NZD"];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Add University</h1>
        <div className="flex items-center gap-2">
          <UniversityScrapeManager
            onScrape={(result) => {
              // map scraped university fields into the form where available
              const u = result.university;
              setForm((f) => ({
                ...f,
                name: u.name?.value ?? f.name,
                country: u.location?.value ?? f.country,
                website: u.description?.value ?? f.website, // crude mapping
                description: u.description?.value ?? f.description,
                foundedYear: u.foundedYear?.value ?? f.foundedYear,
                type: (u.type?.value as "PUBLIC" | "PRIVATE") ?? f.type,
              }));
            }}
          />
          <Link href="/dashboard/universities" className="text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}
      {info && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">{info}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                University Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Country *
              </label>
              <select
                value={form.country}
                onChange={(e) => handleChange("country", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City *
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <div className="flex gap-4 mt-2">
                {(["PUBLIC", "PRIVATE"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.type === t}
                      onChange={() => handleChange("type", t)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rankings and Info */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Rankings & Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                QS World Ranking
              </label>
              <input
                type="number"
                value={form.qsRanking}
                onChange={(e) => handleChange("qsRanking", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Times Higher Education Ranking
              </label>
              <input
                type="number"
                value={form.timesHigherRanking}
                onChange={(e) => handleChange("timesHigherRanking", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Founded Year
              </label>
              <input
                type="number"
                value={form.foundedYear}
                onChange={(e) => handleChange("foundedYear", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Contact and Financial */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Contact & Financial</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => handleChange("contactPerson", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => handleChange("contactEmail", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Default Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Application Fee ({form.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={form.applicationFee}
                onChange={(e) => handleChange("applicationFee", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Additional Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => handleChange("website", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                DLI Number (for Canadian universities)
              </label>
              <input
                type="text"
                value={form.dliNumber}
                onChange={(e) => handleChange("dliNumber", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                About / Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Post-Study Work Visa Info
              </label>
              <textarea
                value={form.postStudyWorkVisa}
                onChange={(e) => handleChange("postStudyWorkVisa", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Media */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Media</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                University Logo
              </label>
              <div
                onClick={() => logoInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                {form.logo && <p className="text-xs text-green-600 mt-2">Logo uploaded</p>}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.currentTarget.files, false)}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Campus Photos
              </label>
              <div
                onClick={() => photosInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Click to upload or drag and drop (multiple files)</p>
              </div>
              <input
                ref={photosInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileUpload(e.currentTarget.files, true)}
                className="hidden"
              />
              {uploadedPhotoPaths.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-slate-700">Uploaded Photos:</p>
                  <div className="flex flex-wrap gap-2">
                    {uploadedPhotoPaths.map((path, i) => (
                      <div key={i} className="relative inline-block">
                        <Image
                          src={path}
                          alt={`Campus ${i}`}
                          width={96}
                          height={96}
                          unoptimized
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Toggle */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleChange("isActive", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Creating..." : "Create University"}
          </button>
          <Link
            href="/dashboard/universities"
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
