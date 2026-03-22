"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";

export default function AgentStudentNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    nationality: "",
    countryOfResidence: "",
    passportNumber: "",
    passportExpiry: "",
    highestQualification: "",
    yearCompleted: "",
    institutionName: "",
    preferredLevel: "",
    preferredDestination: "",
    preferredFieldOfStudy: "",
    notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/agent/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error || "Failed to create student");
      return;
    }

    router.push(`/agent/students/new/success?studentId=${encodeURIComponent(json.data.studentId)}`);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h1 className="text-2xl font-bold text-slate-900">Add New Student</h1>
      <p className="text-sm text-slate-500 mt-1">Create a new student under your agency.</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Personal</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="First Name" className="border rounded-md px-3 py-2 text-sm" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            <input required placeholder="Last Name" className="border rounded-md px-3 py-2 text-sm" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            <input required type="email" placeholder="Email" className="border rounded-md px-3 py-2 text-sm" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <input placeholder="Phone" className="border rounded-md px-3 py-2 text-sm" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            <input type="date" placeholder="Date of Birth" className="border rounded-md px-3 py-2 text-sm" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
            <input placeholder="Nationality" className="border rounded-md px-3 py-2 text-sm" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
            <select className="border rounded-md px-3 py-2 text-sm" value={form.countryOfResidence} onChange={(e) => update("countryOfResidence", e.target.value)}>
              <option value="">Country of Residence</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Passport</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Passport Number" className="border rounded-md px-3 py-2 text-sm" value={form.passportNumber} onChange={(e) => update("passportNumber", e.target.value)} />
            <input type="date" placeholder="Expiry Date" className="border rounded-md px-3 py-2 text-sm" value={form.passportExpiry} onChange={(e) => update("passportExpiry", e.target.value)} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Academic</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <select className="border rounded-md px-3 py-2 text-sm" value={form.highestQualification} onChange={(e) => update("highestQualification", e.target.value)}>
              <option value="">Highest Qualification</option>
              <option value="High School">High School</option>
              <option value="Diploma">Diploma</option>
              <option value="Bachelors">Bachelors</option>
              <option value="Masters">Masters</option>
              <option value="PhD">PhD</option>
            </select>
            <input placeholder="Year Completed" className="border rounded-md px-3 py-2 text-sm" value={form.yearCompleted} onChange={(e) => update("yearCompleted", e.target.value)} />
            <input placeholder="Institution Name" className="border rounded-md px-3 py-2 text-sm" value={form.institutionName} onChange={(e) => update("institutionName", e.target.value)} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Study Interests</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <input placeholder="Level" className="border rounded-md px-3 py-2 text-sm" value={form.preferredLevel} onChange={(e) => update("preferredLevel", e.target.value)} />
            <input placeholder="Preferred Destination" className="border rounded-md px-3 py-2 text-sm" value={form.preferredDestination} onChange={(e) => update("preferredDestination", e.target.value)} />
            <input placeholder="Preferred Field of Study" className="border rounded-md px-3 py-2 text-sm" value={form.preferredFieldOfStudy} onChange={(e) => update("preferredFieldOfStudy", e.target.value)} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
          <textarea rows={4} className="border rounded-md px-3 py-2 text-sm w-full" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </section>

        <button disabled={loading} className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {loading ? "Creating..." : "Create Student"}
        </button>
      </form>
    </div>
  );
}
