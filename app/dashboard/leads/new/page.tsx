"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  COUNTRIES,
  DESTINATION_COUNTRIES,
  COURSE_LEVELS,
  LEAD_SOURCES,
  DIAL_CODES,
} from "@/lib/countries";

type SessionUserExtras = {
  roleName?: string;
  id?: string;
};

interface Counsellor {
  id: string;
  name: string | null;
  email: string;
}

interface SubAgent {
  id: string;
  agencyName: string;
}

export default function AddLeadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as SessionUserExtras;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dialCode: "+91",
    nationality: "",
    countryOfResidence: "",
    source: "",
    preferredDestination: "",
    interestedIn: "",
    notes: "",
    assignedCounsellorId: user.roleName === "COUNSELLOR" ? user.id : "",
    subAgentId: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showNationalityDropdown, setShowNationalityDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");

  const { data: optionsData } = useQuery({
    queryKey: ["leadOptions"],
    queryFn: async () => {
      const res = await fetch("/api/leads/options", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch lead options");
      return res.json();
    },
  });

  const counsellors: Counsellor[] = optionsData?.data?.counsellors || [];
  const subAgents: SubAgent[] = optionsData?.data?.subAgents || [];

  // Filter countries
  const filteredNationalities = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(nationalitySearch.toLowerCase())
  ).slice(0, 10);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  ).slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Client-side validation
      const newErrors: Record<string, string> = {};

      if (!formData.firstName.trim()) newErrors.firstName = "First name required";
      if (!formData.lastName.trim()) newErrors.lastName = "Last name required";
      if (!formData.email.trim()) newErrors.email = "Email required";
      if (!formData.email.includes("@")) newErrors.email = "Invalid email format";
      if (!formData.phone.trim()) newErrors.phone = "Phone required";
      if (!formData.source) newErrors.source = "Source required";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      const isAgentPortal = ["SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(user.roleName || "");
      const endpoint = isAgentPortal ? "/api/agent/leads" : "/api/admin/leads/create";

      // Submit to API
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isAgentPortal
            ? {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: `${formData.dialCode}${formData.phone.trim()}`,
                nationality: formData.nationality || null,
                source: formData.source || "WEBSITE",
                notes: formData.notes || null,
              }
            : {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: `${formData.dialCode}${formData.phone.trim()}`,
                nationality: formData.nationality || null,
                countryOfResidence: formData.countryOfResidence || null,
                source: formData.source,
                preferredDestination: formData.preferredDestination || null,
                interestedIn: formData.interestedIn || null,
                notes: formData.notes || null,
                assignedCounsellorId: formData.assignedCounsellorId || null,
                subAgentId: formData.subAgentId || null,
              }
        ),
      });

      if (res.status === 409) {
        setErrors({ email: "A lead with this email already exists" });
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create lead");
      }

      const { data } = await res.json();

      // Show success and redirect
      const leadId = data?.lead?.id || data?.id;
      if (!leadId) {
        throw new Error("Lead created but no lead ID was returned");
      }
      const destinationBase = isAgentPortal ? "/agent/leads" : "/dashboard/leads";
      router.push(`${destinationBase}/${leadId}`);
      router.refresh();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to create lead",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Add New Lead</h1>
        <p className="text-slate-600">
          Create a new lead entry in the system
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-8">
        {errors.submit && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                placeholder="John"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.firstName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300"
                )}
              />
              {errors.firstName && (
                <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.email ? "border-red-300 bg-red-50" : "border-slate-300"
                )}
              />
              {errors.email && (
                <p className="text-xs text-red-600 mt-1">{errors.email}</p>
              )}
            </div>

            {/* Nationality */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nationality
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowNationalityDropdown(!showNationalityDropdown)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-left flex items-center justify-between hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className={formData.nationality ? "" : "text-slate-500"}>
                    {formData.nationality || "Select nationality"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showNationalityDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={nationalitySearch}
                      onChange={(e) => setNationalitySearch(e.target.value)}
                      className="w-full px-3 py-2 border-b border-slate-200 focus:outline-none text-sm"
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredNationalities.length > 0 ? (
                        filteredNationalities.map((country) => (
                          <button
                            key={country}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                nationality: country,
                              });
                              setShowNationalityDropdown(false);
                              setNationalitySearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                          >
                            {country}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          No results
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Source *
              </label>
              <select
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.source ? "border-red-300 bg-red-50" : "border-slate-300"
                )}
              >
                <option value="">Select source</option>
                {LEAD_SOURCES.map((src) => (
                  <option key={src.value} value={src.value}>
                    {src.label}
                  </option>
                ))}
              </select>
              {errors.source && (
                <p className="text-xs text-red-600 mt-1">{errors.source}</p>
              )}
            </div>

            {/* Interested In */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Interested In (Course Level)
              </label>
              <select
                value={formData.interestedIn}
                onChange={(e) =>
                  setFormData({ ...formData, interestedIn: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select level</option>
                {COURSE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                placeholder="Doe"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.lastName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300"
                )}
              />
              {errors.lastName && (
                <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number *
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.dialCode}
                  onChange={(e) =>
                    setFormData({ ...formData, dialCode: e.target.value })
                  }
                  className="w-24 px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DIAL_CODES.map((dc) => (
                    <option key={dc.code} value={dc.code}>
                      {dc.code}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="9876543210"
                  className={cn(
                    "flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                    errors.phone
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300"
                  )}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Country of Residence */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Country of Residence
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowCountryDropdown(!showCountryDropdown)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-left flex items-center justify-between hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span
                    className={
                      formData.countryOfResidence ? "" : "text-slate-500"
                    }
                  >
                    {formData.countryOfResidence || "Select country"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full px-3 py-2 border-b border-slate-200 focus:outline-none text-sm"
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map((country) => (
                          <button
                            key={country}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                countryOfResidence: country,
                              });
                              setShowCountryDropdown(false);
                              setCountrySearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                          >
                            {country}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          No results
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Counsellor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assigned Counsellor
              </label>
              <select
                value={formData.assignedCounsellorId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assignedCounsellorId: e.target.value,
                  })
                }
                disabled={user.roleName === "COUNSELLOR"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">Unassigned</option>
                {counsellors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email}
                  </option>
                ))}
              </select>
              {user.roleName === "COUNSELLOR" && (
                <p className="text-xs text-slate-500 mt-1">
                  Automatically assigned to you
                </p>
              )}
            </div>

            {/* Sub-Agent */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sub-Agent (Optional)
              </label>
              <select
                value={formData.subAgentId}
                onChange={(e) =>
                  setFormData({ ...formData, subAgentId: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {subAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.agencyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Preferred Destination */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Preferred Destination
              </label>
              <select
                value={formData.preferredDestination}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredDestination: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select destination</option>
                {DESTINATION_COUNTRIES.map((dest) => (
                  <option key={dest} value={dest}>
                    {dest}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-8">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2 font-medium"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Lead
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
