"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import BrandLogo from "@/components/ui/BrandLogo";

export default function AgentRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dialCode: "+44",
    phone: "",
    password: "",
    confirmPassword: "",
    agencyName: "",
    country: "",
    city: "",
    website: "",
    agreed: false,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Registration failed");
        return;
      }
      router.push("/agent/register/success");
    } catch {
      setError("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-[#1B2A4A] px-8 py-8">
          <BrandLogo variant="white" width={210} />
          <h1 className="mt-4 text-2xl font-bold text-white">Sub-Agent Registration</h1>
          <p className="text-white/80 mt-1 text-sm">Partner with EduQuantica as an approved recruitment sub-agent.</p>
        </div>

        <form onSubmit={submit} className="p-8 space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="First Name" className="border rounded-lg px-3 py-2" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            <input required placeholder="Last Name" className="border rounded-lg px-3 py-2" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            <input required type="email" placeholder="Email" className="border rounded-lg px-3 py-2" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <div className="flex gap-2">
              <input required placeholder="+44" className="border rounded-lg px-3 py-2 w-28" value={form.dialCode} onChange={(e) => update("dialCode", e.target.value)} />
              <input required placeholder="Phone" className="border rounded-lg px-3 py-2 flex-1" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <input required type="password" placeholder="Password" className="border rounded-lg px-3 py-2" value={form.password} onChange={(e) => update("password", e.target.value)} />
            <input required type="password" placeholder="Confirm Password" className="border rounded-lg px-3 py-2" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />

            <input required placeholder="Agency/Company Name" className="border rounded-lg px-3 py-2 sm:col-span-2" value={form.agencyName} onChange={(e) => update("agencyName", e.target.value)} />

            <select required className="border rounded-lg px-3 py-2" value={form.country} onChange={(e) => update("country", e.target.value)}>
              <option value="">Select Country</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
            <input required placeholder="City" className="border rounded-lg px-3 py-2" value={form.city} onChange={(e) => update("city", e.target.value)} />
            <input placeholder="Website (optional)" className="border rounded-lg px-3 py-2 sm:col-span-2" value={form.website} onChange={(e) => update("website", e.target.value)} />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.agreed} onChange={(e) => update("agreed", e.target.checked)} className="mt-0.5" />
            I agree to EduQuantica Terms and Conditions and Sub-Agent Agreement
          </label>

          <button disabled={loading} className="w-full eq-primary-btn rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
