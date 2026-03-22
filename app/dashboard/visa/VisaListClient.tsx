"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface Counsellor {
  id: string;
  name: string | null;
  email: string;
}

interface VisaRow {
  applicationId: string;
  studentName: string;
  universityName: string;
  country: string;
  type: string;
  status: string;
  appointmentDate: string | null;
  decisionAt: string | null;
  counsellorName: string | null;
}

interface VisaListClientProps {
  counsellors: Counsellor[];
  countries: string[];
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PREPARING", label: "Not Started" },
  { value: "SUBMITTED", label: "In Progress" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const TYPE_BY_COUNTRY: Record<string, string> = {
  "United Kingdom": "Student Visa Tier 4",
  Canada: "Study Permit",
  Australia: "Student Visa",
  "United States": "F-1",
};

export default function VisaListClient({ counsellors, countries }: VisaListClientProps) {
  const [filters, setFilters] = useState({
    status: "",
    country: "",
    counsellor: "",
    search: "",
  });

  const { data, isLoading } = useQuery<VisaRow[]>({
    queryKey: ["visas", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.country) params.set("country", filters.country);
      if (filters.counsellor) params.set("counsellor", filters.counsellor);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/dashboard/visa?${params.toString()}`);
      const json = await res.json();
      // backend shape for each visa application we include
      type RawVisa = {
        applicationId: string;
        student: { id: string; firstName: string; lastName: string };
        application: {
          university: { name: string };
          counsellor?: { name: string | null };
        };
        country: string;
        status: string;
        appointmentDate: string | null;
        decisionAt: string | null;
      };

      const list: RawVisa[] = json.data || [];
      return list.map((v) => ({
        applicationId: v.applicationId,
        studentName: `${v.student.firstName} ${v.student.lastName}`,
        universityName: v.application.university.name,
        country: v.country,
        type: TYPE_BY_COUNTRY[v.country] || "",
        status: v.status,
        appointmentDate: v.appointmentDate,
        decisionAt: v.decisionAt,
        counsellorName: v.application.counsellor?.name || null,
      }));
    },
  });

  function updateFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="input">
          {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <select value={filters.country} onChange={(e) => updateFilter("country", e.target.value)} className="input">
          <option value="">All countries</option>
          {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select value={filters.counsellor} onChange={(e) => updateFilter("counsellor", e.target.value)} className="input">
          <option value="">All counsellors</option>
          {counsellors.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
        </select>
        <input
          type="text"
          placeholder="Search student"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="input"
        />
      </div>

      {isLoading && <Loader2 className="w-6 h-6 animate-spin" />}

      {!isLoading && data && (
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">University | Country</th>
                <th className="px-4 py-2">Visa Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Appointment</th>
                <th className="px-4 py-2">Decision</th>
                <th className="px-4 py-2">Counsellor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.applicationId} className="border-t">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/visa/${row.applicationId}`} className="text-blue-600 hover:underline">
                      {row.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {row.universityName} | {row.country}
                  </td>
                  <td className="px-4 py-2">{row.type}</td>
                  <td className="px-4 py-2">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium",
                      {
                        PREPARING: "bg-gray-100 text-gray-700",
                        SUBMITTED: "bg-blue-100 text-blue-700",
                        APPROVED: "bg-emerald-100 text-emerald-700",
                        REJECTED: "bg-red-100 text-red-700",
                      }[row.status] || "bg-gray-100 text-gray-700",
                    )}>{row.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-2">{row.appointmentDate ? new Date(row.appointmentDate).toLocaleDateString() : ""}</td>
                  <td className="px-4 py-2">{row.decisionAt ? new Date(row.decisionAt).toLocaleDateString() : ""}</td>
                  <td className="px-4 py-2">{row.counsellorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
