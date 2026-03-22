"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import Link from "next/link";

interface University {
  id: string;
  name: string;
  country: string;
  city: string | null;
  type: "PUBLIC" | "PRIVATE" | null;
  qsRanking: number | null;
  timesHigherRanking: number | null;
  isActive: boolean;
  totalCourses: number;
  activeScholarships: number;
}

interface UniversitiesClientProps {
  initialCountries: string[];
}

export default function UniversitiesClient({ initialCountries }: UniversitiesClientProps) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["universities", { search, country, type, status, skip }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (country) params.append("country", country);
      if (type) params.append("type", type);
      if (status) params.append("status", status);
      params.append("skip", skip.toString());
      params.append("take", take.toString());

      const res = await fetch(`/api/admin/universities?${params}`);
      if (!res.ok) throw new Error("Failed to fetch universities");
      const json = await res.json();
      return json.data;
    },
  });

  const universities = useMemo(() => data?.universities ?? [], [data?.universities]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / take);

  const countrySet = useMemo(() => {
    const seen = new Set(initialCountries);
    universities.forEach((u: University) => seen.add(u.country));
    return seen;
  }, [initialCountries, universities]);

  const countries = useMemo(() => {
    return Array.from(countrySet).sort();
  }, [countrySet]);

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Universities</h1>
        <Link
          href="/dashboard/universities/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add University
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by university name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSkip(0);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Country Filter */}
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setSkip(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setSkip(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Types</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSkip(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">University Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Country</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">City</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">QS Ranking</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Times Ranking</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Courses</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Scholarships</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : universities.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                  No universities found
                </td>
              </tr>
            ) : (
              universities.map((u: University) => (
                <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/universities/${u.id}`} className="text-blue-600 hover:underline font-medium">
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{u.country}</td>
                  <td className="px-6 py-4 text-slate-600">{u.city || "—"}</td>
                  <td className="px-6 py-4">
                    {u.type && (
                      <Badge className={u.type === "PUBLIC" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}>
                        {u.type}
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{u.qsRanking || "—"}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{u.timesHigherRanking || "—"}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{u.totalCourses}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{u.activeScholarships}</td>
                  <td className="px-6 py-4 text-center">
                    <Badge className={u.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {skip + 1} to {Math.min(skip + take, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSkip(Math.max(0, skip - take))}
              disabled={skip === 0}
              className="px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSkip(i * take)}
                  className={`px-3 py-2 rounded-lg ${
                    Math.floor(skip / take) === i
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSkip(skip + take)}
              disabled={skip + take >= total}
              className="px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{children}</span>;
}
