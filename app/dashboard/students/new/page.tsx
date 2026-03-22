"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface SessionUserExtras {
  roleName?: string;
  id?: string;
}

export default function AddStudentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as SessionUserExtras;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "",
    address: "",
    passportNumber: "",
    passportExpiry: "",
    dateOfBirth: "",
    assignedCounsellorId: user.roleName === "COUNSELLOR" ? user.id : "",
    subAgentId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { data: counsellorsData } = useQuery({
    queryKey: ["counsellors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/users?role=COUNSELLOR");
      if (!res.ok) throw new Error("Failed to fetch counsellors");
      return res.json();
    },
  });
  const counsellors: Array<{ id: string; name: string | null }> =
    counsellorsData?.data?.users || [];

  const { data: subAgentsData } = useQuery({
    queryKey: ["subAgents"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sub-agents/list?status=approved");
      if (!res.ok) throw new Error("Failed to fetch sub-agents");
      return res.json();
    },
  });
  const subAgents: Array<{ id: string; agencyName: string }> =
    subAgentsData?.data?.subAgents || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const newErrors: Record<string, string> = {};
      if (!formData.firstName.trim()) newErrors.firstName = "First name required";
      if (!formData.lastName.trim()) newErrors.lastName = "Last name required";
      if (!formData.email.trim()) newErrors.email = "Email required";
      if (!formData.email.includes("@")) newErrors.email = "Invalid email";
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      const res = await fetch("/api/admin/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone || null,
          nationality: formData.nationality || null,
          countryOfResidence: formData.address || null,
          assignedCounsellorId: formData.assignedCounsellorId || null,
          subAgentId: formData.subAgentId || null,
          dateOfBirth: formData.dateOfBirth || null,
          passportNumber: formData.passportNumber || null,
          passportExpiry: formData.passportExpiry || null,
        }),
      });

      if (res.status === 409) {
        setErrors({ email: "A user with this email already exists" });
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create student");
      }

      const { data } = await res.json();
      router.push(`/dashboard/students/${data.student.id}`);
      router.refresh();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Add New Student</h1>
        <p className="text-slate-600">Create a student profile</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-8">
        {errors.submit && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errors.submit}
          </div>
        )}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.firstName ? "border-red-300 bg-red-50" : "border-slate-300"
                )}
              />
              {errors.firstName && (
                <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.lastName ? "border-red-300 bg-red-50" : "border-slate-300"
                )}
              />
              {errors.lastName && (
                <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nationality
              </label>
              <input
                type="text"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assigned Counsellor
              </label>
              <select
                value={formData.assignedCounsellorId}
                onChange={(e) => setFormData({ ...formData, assignedCounsellorId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Unassigned</option>
                {counsellors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sub-Agent
              </label>
              <select
                value={formData.subAgentId}
                onChange={(e) => setFormData({ ...formData, subAgentId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">None</option>
                {subAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.agencyName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* right column could hold passport/dob/date fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Passport Number
              </label>
              <input
                type="text"
                value={formData.passportNumber}
                onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Passport Expiry
              </label>
              <input
                type="date"
                value={formData.passportExpiry || ""}
                onChange={(e) => setFormData({ ...formData, passportExpiry: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth || ""}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Create Student"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
