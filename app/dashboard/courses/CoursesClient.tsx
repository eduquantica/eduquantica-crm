"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import CurrencyDisplay from "@/components/CurrencyDisplay";

interface Course {
  id: string;
  name: string;
  fieldOfStudy: string;
  level: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  tags: string[];
  isActive: boolean;
  universityName: string;
  universityCountry: string;
  universityId: string;
  hasScholarship: boolean;
  scholarshipPreview: {
    id: string;
    name: string;
    amount: number;
    amountType: "FIXED" | "PERCENTAGE";
    deadline: string | null;
  } | null;
  nextIntake: string | null;
}

interface CoursesClientProps {
  initialCountries: string[];
  initialUniversities: Array<{ id: string; name: string }>;
  fieldOfStudyOptions: string[];
}

const LEVEL_OPTIONS = [
  { value: "FOUNDATION", label: "Foundation" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "BACHELORS", label: "Undergraduate" },
  { value: "MASTERS", label: "Postgraduate" },
  { value: "PHD", label: "PhD" },
];

const INTAKE_MONTH_OPTIONS = [
  { value: "2024-09", label: "September 2024" },
  { value: "2025-01", label: "January 2025" },
  { value: "2025-06", label: "June 2025" },
  { value: "2025-09", label: "September 2025" },
  { value: "2026-01", label: "January 2026" },
];

export default function CoursesClient({
  initialCountries,
  initialUniversities,
  fieldOfStudyOptions,
}: CoursesClientProps) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [intakeMonth, setIntakeMonth] = useState("");
  const [hasScholarship, setHasScholarship] = useState(false);
  const [minScholarship, setMinScholarship] = useState("0");
  const [fullScholarshipOnly, setFullScholarshipOnly] = useState(false);
  const [openForNationality, setOpenForNationality] = useState(false);
  const [deadlineNotPassed, setDeadlineNotPassed] = useState(false);
  const [scholarshipNationality, setScholarshipNationality] = useState("");
  const [minFee, setMinFee] = useState("");
  const [maxFee, setMaxFee] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const { data, isLoading } = useQuery({
    queryKey: [
      "courses",
      {
        search,
        country,
        level,
        fieldOfStudy,
        intakeMonth,
        hasScholarship,
        minScholarship,
        fullScholarshipOnly,
        openForNationality,
        deadlineNotPassed,
        scholarshipNationality,
        minFee,
        maxFee,
        universityId,
        status,
        skip,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (country) params.append("country", country);
      if (level) params.append("level", level);
      if (fieldOfStudy) params.append("fieldOfStudy", fieldOfStudy);
      if (intakeMonth) params.append("intakeMonth", intakeMonth);
      if (hasScholarship) params.append("hasScholarship", "true");
      if (Number(minScholarship) > 0) params.append("minScholarship", minScholarship);
      if (fullScholarshipOnly) params.append("fullScholarshipOnly", "true");
      if (openForNationality) params.append("openForNationality", "true");
      if (deadlineNotPassed) params.append("deadlineNotPassed", "true");
      if (openForNationality && scholarshipNationality) params.append("scholarshipNationality", scholarshipNationality);
      if (minFee) params.append("minFee", minFee);
      if (maxFee) params.append("maxFee", maxFee);
      if (universityId) params.append("universityId", universityId);
      if (status) params.append("status", status);
      params.append("skip", skip.toString());
      params.append("take", take.toString());

      const res = await fetch(`/api/admin/courses?${params}`);
      if (!res.ok) {
        console.error("[CoursesClient] Failed to fetch courses", {
          status: res.status,
          statusText: res.statusText,
          query: params.toString(),
        });
        throw new Error("Failed to fetch courses");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const courses = data?.courses ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / take);

  const hasSomeFilters = !!(
    search
    || country
    || level
    || fieldOfStudy
    || intakeMonth
    || hasScholarship
    || Number(minScholarship) > 0
    || fullScholarshipOnly
    || openForNationality
    || deadlineNotPassed
    || scholarshipNationality
    || minFee
    || maxFee
    || universityId
    || status
  );

  const handleClearFilters = () => {
    setSearch("");
    setCountry("");
    setLevel("");
    setFieldOfStudy("");
    setIntakeMonth("");
    setHasScholarship(false);
    setMinScholarship("0");
    setFullScholarshipOnly(false);
    setOpenForNationality(false);
    setDeadlineNotPassed(false);
    setScholarshipNationality("");
    setMinFee("");
    setMaxFee("");
    setUniversityId("");
    setStatus("");
    setSkip(0);
  };

  const levelLabel = LEVEL_OPTIONS.find((l) => l.value === level)?.label;
  const intakeLabel = INTAKE_MONTH_OPTIONS.find((i) => i.value === intakeMonth)?.label;
  const universityLabel = initialUniversities.find((u) => u.id === universityId)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Courses</h1>
        <Link
          href="/dashboard/courses/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          Add Course
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Search Course Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSkip(0);
                }}
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Country</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Countries</option>
              {initialCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Level */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Level</label>
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Field of Study */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Field of Study</label>
            <select
              value={fieldOfStudy}
              onChange={(e) => {
                setFieldOfStudy(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Fields</option>
              {fieldOfStudyOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Intake Month */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Intake Month/Year</label>
            <select
              value={intakeMonth}
              onChange={(e) => {
                setIntakeMonth(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Intakes</option>
              {INTAKE_MONTH_OPTIONS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          {/* University */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">University</label>
            <select
              value={universityId}
              onChange={(e) => {
                setUniversityId(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Universities</option>
              {initialUniversities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Min Fee */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Min Tuition Fee</label>
            <input
              type="number"
              placeholder="Min fee"
              value={minFee}
              onChange={(e) => {
                setMinFee(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Max Fee */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Max Tuition Fee</label>
            <input
              type="number"
              placeholder="Max fee"
              value={maxFee}
              onChange={(e) => {
                setMaxFee(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Scholarship Toggle */}
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={hasScholarship}
                onChange={(e) => {
                  setHasScholarship(e.target.checked);
                  setSkip(0);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Has Scholarship
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Minimum Scholarship Value</label>
            <input
              type="range"
              min="0"
              max="10000"
              step="250"
              value={minScholarship}
              onChange={(e) => {
                setMinScholarship(e.target.value);
                setSkip(0);
              }}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">{Number(minScholarship) > 0 ? `≥ ${Number(minScholarship).toLocaleString()}` : "Any amount"}</p>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={fullScholarshipOnly}
                onChange={(e) => {
                  setFullScholarshipOnly(e.target.checked);
                  setSkip(0);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Full Scholarships Only
            </label>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={openForNationality}
                onChange={(e) => {
                  setOpenForNationality(e.target.checked);
                  setSkip(0);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Open For Nationality
            </label>
          </div>

          {openForNationality && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Nationality Code</label>
              <input
                type="text"
                maxLength={3}
                placeholder="e.g. BD"
                value={scholarshipNationality}
                onChange={(e) => {
                  setScholarshipNationality(e.target.value.toUpperCase());
                  setSkip(0);
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={deadlineNotPassed}
                onChange={(e) => {
                  setDeadlineNotPassed(e.target.checked);
                  setSkip(0);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Deadline Not Passed
            </label>
          </div>
        </div>

        {/* Clear Filters */}
        {hasSomeFilters && (
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <X size={16} />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasSomeFilters && (
        <div className="flex flex-wrap gap-2">
          {search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              Search: {search}
              <button onClick={() => setSearch("")}>×</button>
            </span>
          )}
          {country && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {country}
              <button onClick={() => setCountry("")}>×</button>
            </span>
          )}
          {levelLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {levelLabel}
              <button onClick={() => setLevel("")}>×</button>
            </span>
          )}
          {fieldOfStudy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {fieldOfStudy}
              <button onClick={() => setFieldOfStudy("")}>×</button>
            </span>
          )}
          {intakeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {intakeLabel}
              <button onClick={() => setIntakeMonth("")}>×</button>
            </span>
          )}
          {universityLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {universityLabel}
              <button onClick={() => setUniversityId("")}>×</button>
            </span>
          )}
          {minFee && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              Min: £{minFee}
              <button onClick={() => setMinFee("")}>×</button>
            </span>
          )}
          {maxFee && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              Max: £{maxFee}
              <button onClick={() => setMaxFee("")}>×</button>
            </span>
          )}
          {hasScholarship && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              Has Scholarship
              <button onClick={() => setHasScholarship(false)}>×</button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Course Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">University</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Country</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Level</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Tuition Fee</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">App Fee</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Next Intake</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Scholarship</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">
                    No courses found
                  </td>
                </tr>
              ) : (
                courses.map((course: Course) => (
                  <tr key={course.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/courses/${course.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {course.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/universities/${course.universityId}`} className="text-sm text-blue-600 hover:underline">
                        {course.universityName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{course.universityCountry}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                        {course.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{course.duration || "-"}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {course.tuitionFee ? (
                        <CurrencyDisplay
                          amount={course.tuitionFee}
                          baseCurrency={course.currency}
                        />
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {course.applicationFee ? (
                        <CurrencyDisplay
                          amount={course.applicationFee}
                          baseCurrency={course.currency}
                        />
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{course.nextIntake || "-"}</td>
                    <td className="px-6 py-4 text-center">
                      {course.hasScholarship ? (
                        <span
                          title={course.scholarshipPreview
                            ? `${course.scholarshipPreview.name} • ${course.scholarshipPreview.amountType === "PERCENTAGE" ? `${course.scholarshipPreview.amount}%` : course.scholarshipPreview.amount.toLocaleString()} • Deadline ${course.scholarshipPreview.deadline ? new Date(course.scholarshipPreview.deadline).toLocaleDateString("en-GB") : "N/A"}`
                            : "Scholarship available"
                          }
                          className="inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
                        >
                          Scholarship Available
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-block rounded-full px-3 py-1 text-xs font-medium",
                          course.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        )}
                      >
                        {course.isActive ? "Active" : "Inactive"}
                      </span>
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
            <p className="text-sm text-gray-600">
              Page {Math.floor(skip / take) + 1} of {totalPages} ({total} total courses)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSkip(Math.max(0, skip - take))}
                disabled={skip === 0}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setSkip(skip + take)}
                disabled={skip + take >= total}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
