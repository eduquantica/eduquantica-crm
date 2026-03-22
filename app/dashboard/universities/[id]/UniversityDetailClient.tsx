"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Trophy, Calendar } from "lucide-react";
import Image from "next/image";
import UniversityScrapeManager from "@/components/UniversityScrapeManager";
import CurrencyDisplay from "@/components/CurrencyDisplay";

interface Course {
  id: string;
  name: string;
  level: string;
  tuitionFee?: number;
  currency: string;
}

interface Scholarship {
  id: string;
  name: string;
  amount: number;
  currency: string;
  amountType: "FIXED" | "PERCENTAGE";
  percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
  eligibilityCriteria: string;
  deadline: string | null;
  intakePeriod: string | null;
  isPartial: boolean;
  minAcademicScore: number | null;
  minEnglishScore: number | null;
  nationalityRestrictions: string[];
  applicationProcess: string | null;
  externalUrl: string | null;
  course: { id: string; name: string } | null;
  _count?: { applications: number };
  isActive: boolean;
}

interface CommissionAgreement {
  id: string;
  commissionRate: number;
  currency: string;
  agreedDate: string | null;
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  isActive: boolean;
}

interface CommissionHistoryEntry {
  id: string;
  createdAt: string;
  details: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface University {
  id: string;
  name: string;
  country: string;
  city: string | null;
  type: "PUBLIC" | "PRIVATE" | null;
  qsRanking: number | null;
  timesHigherRanking: number | null;
  website: string | null;
  logo: string | null;
  description: string | null;
  foundedYear: number | null;
  dliNumber: string | null;
  applicationFee: number | null;
  currency: string;
  isActive: boolean;
  contactPerson: string | null;
  contactEmail: string | null;
  campusPhotos: string[];
  postStudyWorkVisa: string | null;
  courses: Course[];
  scholarships: Scholarship[];
  commissionAgreement: CommissionAgreement | null;
}

interface UniversityDetailClientProps {
  universityId: string;
}

export default function UniversityDetailClient({ universityId }: UniversityDetailClientProps) {
  const [loading, setLoading] = useState(true);
  const [university, setUniversity] = useState<University | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [commissionHistory, setCommissionHistory] = useState<CommissionHistoryEntry[]>([]);
  const [commissionRate, setCommissionRate] = useState("");
  const [agreementStartDate, setAgreementStartDate] = useState("");
  const [agreementEndDate, setAgreementEndDate] = useState("");
  const [agreementNotes, setAgreementNotes] = useState("");
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [scholarshipError, setScholarshipError] = useState<string | null>(null);
  const [savingScholarship, setSavingScholarship] = useState(false);
  const [editingScholarshipId, setEditingScholarshipId] = useState<string | null>(null);
  const [scholarshipForm, setScholarshipForm] = useState({
    name: "",
    courseId: "",
    amountType: "FIXED" as "FIXED" | "PERCENTAGE",
    amount: "",
    percentageOf: "TUITION" as "TUITION" | "LIVING" | "TOTAL",
    isPartial: false,
    deadline: "",
    intakePeriod: "",
    eligibilityCriteria: "",
    nationalityRestrictions: "",
    minAcademicScore: "",
    minEnglishScore: "",
    isAutoRenewable: false,
    applicationProcess: "",
    externalUrl: "",
    isActive: true,
  });

  useEffect(() => {
    const fetchUniversity = async () => {
      try {
        const res = await fetch(`/api/admin/universities/${universityId}`);
        if (!res.ok) throw new Error("Failed to fetch university");
        const data = await res.json();
        setUniversity(data.data.university);
        setCommissionHistory(data.data.commissionHistory || []);

        const agreement = data.data.university?.commissionAgreement;
        setCommissionRate(agreement?.commissionRate ? String(agreement.commissionRate) : "");
        setAgreementStartDate(agreement?.agreedDate ? String(agreement.agreedDate).slice(0, 10) : "");
        setAgreementEndDate(agreement?.validUntil ? String(agreement.validUntil).slice(0, 10) : "");
        setAgreementNotes(agreement?.notes || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchUniversity();
  }, [universityId]);

  const fetchScholarships = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/universities/${universityId}/scholarships`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load scholarships");
      }
      setScholarships(json.data || []);
      setScholarshipError(null);
    } catch (err) {
      setScholarshipError(err instanceof Error ? err.message : "Failed to load scholarships");
    }
  }, [universityId]);

  useEffect(() => {
    if (activeTab !== "scholarships") return;
    void fetchScholarships();
  }, [activeTab, fetchScholarships]);

  function resetScholarshipForm() {
    setScholarshipForm({
      name: "",
      courseId: "",
      amountType: "FIXED",
      amount: "",
      percentageOf: "TUITION",
      isPartial: false,
      deadline: "",
      intakePeriod: "",
      eligibilityCriteria: "",
      nationalityRestrictions: "",
      minAcademicScore: "",
      minEnglishScore: "",
      isAutoRenewable: false,
      applicationProcess: "",
      externalUrl: "",
      isActive: true,
    });
    setEditingScholarshipId(null);
  }

  async function submitScholarship() {
    if (!scholarshipForm.name.trim() || !scholarshipForm.amount || !scholarshipForm.eligibilityCriteria.trim()) {
      setScholarshipError("Name, amount, and eligibility criteria are required");
      return;
    }

    const payload = {
      name: scholarshipForm.name.trim(),
      courseId: scholarshipForm.courseId || null,
      amountType: scholarshipForm.amountType,
      amount: Number(scholarshipForm.amount),
      percentageOf: scholarshipForm.amountType === "PERCENTAGE" ? scholarshipForm.percentageOf : null,
      isPartial: scholarshipForm.isPartial,
      deadline: scholarshipForm.deadline ? new Date(`${scholarshipForm.deadline}T00:00:00.000Z`).toISOString() : null,
      intakePeriod: scholarshipForm.intakePeriod.trim() || null,
      eligibilityCriteria: scholarshipForm.eligibilityCriteria.trim(),
      nationalityRestrictions: scholarshipForm.nationalityRestrictions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      minAcademicScore: scholarshipForm.minAcademicScore ? Number(scholarshipForm.minAcademicScore) : null,
      minEnglishScore: scholarshipForm.minEnglishScore ? Number(scholarshipForm.minEnglishScore) : null,
      isAutoRenewable: scholarshipForm.isAutoRenewable,
      applicationProcess: scholarshipForm.applicationProcess.trim() || null,
      externalUrl: scholarshipForm.externalUrl.trim() || null,
      isActive: scholarshipForm.isActive,
    };

    setSavingScholarship(true);
    setScholarshipError(null);
    try {
      const endpoint = editingScholarshipId
        ? `/api/admin/universities/${universityId}/scholarships/${editingScholarshipId}`
        : `/api/admin/universities/${universityId}/scholarships`;
      const method = editingScholarshipId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save scholarship");
      }
      resetScholarshipForm();
      await fetchScholarships();
    } catch (err) {
      setScholarshipError(err instanceof Error ? err.message : "Failed to save scholarship");
    } finally {
      setSavingScholarship(false);
    }
  }

  function startEditScholarship(scholarship: Scholarship) {
    setEditingScholarshipId(scholarship.id);
    setScholarshipForm({
      name: scholarship.name,
      courseId: scholarship.course?.id || "",
      amountType: scholarship.amountType,
      amount: String(scholarship.amount),
      percentageOf: scholarship.percentageOf || "TUITION",
      isPartial: scholarship.isPartial,
      deadline: scholarship.deadline ? String(scholarship.deadline).slice(0, 10) : "",
      intakePeriod: scholarship.intakePeriod || "",
      eligibilityCriteria: scholarship.eligibilityCriteria,
      nationalityRestrictions: (scholarship.nationalityRestrictions || []).join(", "),
      minAcademicScore: scholarship.minAcademicScore != null ? String(scholarship.minAcademicScore) : "",
      minEnglishScore: scholarship.minEnglishScore != null ? String(scholarship.minEnglishScore) : "",
      isAutoRenewable: false,
      applicationProcess: scholarship.applicationProcess || "",
      externalUrl: scholarship.externalUrl || "",
      isActive: scholarship.isActive,
    });
    setActiveTab("scholarships");
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">{error}</div>;
  }

  if (!university) {
    return <div className="p-6 text-center text-slate-600">University not found</div>;
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "programs", label: "Programs" },
    { id: "scholarships", label: "Scholarships" },
    { id: "commission", label: "Commission Agreement" },
    { id: "stats", label: "Application Stats" },
  ];

  const activeCourses = university.courses?.length || 0;
  const activeScholarships = university.scholarships?.filter((s) => s.isActive)?.length || 0;

  const saveCommissionAgreement = async () => {
    const parsedRate = Number(commissionRate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setError("Please enter a valid commission rate");
      return;
    }
    if (parsedRate > 30) {
      setError("University commission rate cannot exceed 30%");
      return;
    }

    setSavingAgreement(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/universities/${universityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionAgreement: {
            commissionRate: parsedRate,
            agreedDate: agreementStartDate ? new Date(`${agreementStartDate}T00:00:00.000Z`).toISOString() : null,
            validUntil: agreementEndDate ? new Date(`${agreementEndDate}T00:00:00.000Z`).toISOString() : null,
            notes: agreementNotes || null,
          },
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save commission agreement");
      }

      const reload = await fetch(`/api/admin/universities/${universityId}`);
      if (reload.ok) {
        const json = await reload.json();
        setUniversity(json.data.university);
        setCommissionHistory(json.data.commissionHistory || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save commission agreement");
    } finally {
      setSavingAgreement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex gap-6 flex-1">
          {university.logo && (
            <Image
              src={university.logo}
              alt={university.name}
              width={120}
              height={120}
              className="rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-slate-900">{university.name}</h1>
              <div className="flex items-center gap-2">
                <UniversityScrapeManager universityId={universityId} />
                <Link href="/dashboard/universities" className="flex items-center gap-1 text-slate-600 hover:text-slate-900">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {university.city}, {university.country}
              </div>
              {university.type && <span className="px-2 py-1 bg-slate-100 rounded text-slate-700">{university.type}</span>}
              {university.website && (
                <a
                  href={university.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  Website
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="flex gap-6">
              {university.qsRanking && (
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">QS: #{university.qsRanking}</span>
                </div>
              )}
              {university.timesHigherRanking && (
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium">Times: #{university.timesHigherRanking}</span>
                </div>
              )}
              {university.foundedYear && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium">Founded {university.foundedYear}</span>
                </div>
              )}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              university.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
            }`}
          >
            {university.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Programs", value: activeCourses },
          { label: "Active Scholarships", value: activeScholarships },
          { label: "Commission Rate", value: university.commissionAgreement?.commissionRate || "—" },
          { label: "Currency", value: university.currency },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Tab buttons */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-colors ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* About */}
              {university.description && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">About</h3>
                  <p className="text-slate-600 whitespace-pre-wrap">{university.description}</p>
                </div>
              )}

              {/* Campus Photos Gallery */}
              {university.campusPhotos && university.campusPhotos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Campus Photos</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {university.campusPhotos.map((photo, i) => (
                      <Image
                        key={i}
                        src={photo}
                        alt={`Campus ${i}`}
                        width={300}
                        height={200}
                        className="rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Institution Details Sidebar */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Institution Details</h3>
                  <dl className="space-y-4">
                    {[
                      { key: "Founded", value: university.foundedYear },
                      { key: "Type", value: university.type },
                      { key: "DLI Number", value: university.dliNumber },
                      { key: "Default Currency", value: university.currency },
                      { key: "Application Fee", value: university.applicationFee ? `${university.currency} ${university.applicationFee.toFixed(2)}` : "—" },
                    ].map((item, i) => (
                      <div key={i}>
                        <dt className="text-sm font-medium text-slate-600">{item.key}</dt>
                        <dd className="text-sm text-slate-900 mt-1">{item.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Post-Study Work Visa</h3>
                  {university.postStudyWorkVisa ? (
                    <p className="text-slate-600 whitespace-pre-wrap">{university.postStudyWorkVisa}</p>
                  ) : (
                    <p className="text-slate-500 italic">No information added</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Information</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Contact Person</dt>
                    <dd className="text-sm text-slate-900 mt-1">{university.contactPerson || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Contact Email</dt>
                    <dd className="text-sm text-slate-900 mt-1">{university.contactEmail || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === "programs" && (
            <div>
              <div className="mb-4 flex justify-between">
            <div />
            <div className="flex gap-2">
              <Link
                href={`/dashboard/courses/new?universityId=${universityId}`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Add Course
              </Link>
              <Link
                href={`/dashboard/universities/${universityId}/import-courses`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Import Courses
              </Link>
            </div>
          </div>
          {university.courses && university.courses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-medium text-slate-700">Course Name</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">Level</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">Tuition Fee</th>
                        <th className="text-center py-3 px-4 font-medium text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {university.courses.map((course) => (
                        <tr key={course.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4">{course.name}</td>
                          <td className="py-3 px-4">{course.level}</td>
                          <td className="py-3 px-4">{course.tuitionFee ? (
                            <CurrencyDisplay
                              amount={course.tuitionFee}
                              baseCurrency={course.currency}
                            />
                          ) : "—"}</td>
                          <td className="py-3 px-4 text-center">
                            <Link href={`/dashboard/courses/${course.id}`} className="text-blue-600 hover:underline text-xs">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No courses added yet</p>
                  <div className="mt-2 flex justify-center gap-4">
                    <Link
                      href={`/dashboard/courses/new?universityId=${universityId}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      + Add Course
                    </Link>
                    <Link
                      href={`/dashboard/universities/${universityId}/import-courses`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      + Import Courses
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "scholarships" && (
            <div className="space-y-6">
              {scholarshipError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {scholarshipError}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  {editingScholarshipId ? "Edit Scholarship" : "Create Scholarship"}
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                    <input
                      value={scholarshipForm.name}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Course (optional)</label>
                    <select
                      value={scholarshipForm.courseId}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, courseId: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">University-wide scholarship</option>
                      {university.courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Amount Type</label>
                    <select
                      value={scholarshipForm.amountType}
                      onChange={(e) =>
                        setScholarshipForm((prev) => ({
                          ...prev,
                          amountType: e.target.value as "FIXED" | "PERCENTAGE",
                        }))
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="FIXED">Fixed</option>
                      <option value="PERCENTAGE">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={scholarshipForm.amount}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  {scholarshipForm.amountType === "PERCENTAGE" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Percentage Of</label>
                      <select
                        value={scholarshipForm.percentageOf}
                        onChange={(e) =>
                          setScholarshipForm((prev) => ({ ...prev, percentageOf: e.target.value as "TUITION" | "LIVING" | "TOTAL" }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="TUITION">Tuition</option>
                        <option value="LIVING">Living</option>
                        <option value="TOTAL">Total</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Deadline</label>
                    <input
                      type="date"
                      value={scholarshipForm.deadline}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, deadline: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Intake Period</label>
                    <input
                      value={scholarshipForm.intakePeriod}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, intakePeriod: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Min Academic Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={scholarshipForm.minAcademicScore}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, minAcademicScore: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Min English Score</label>
                    <input
                      type="number"
                      min="0"
                      max="9"
                      step="0.1"
                      value={scholarshipForm.minEnglishScore}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, minEnglishScore: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Eligibility Criteria</label>
                    <textarea
                      rows={3}
                      value={scholarshipForm.eligibilityCriteria}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, eligibilityCriteria: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Nationality Restrictions (comma-separated)</label>
                    <input
                      value={scholarshipForm.nationalityRestrictions}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, nationalityRestrictions: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Application Process</label>
                    <textarea
                      rows={2}
                      value={scholarshipForm.applicationProcess}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, applicationProcess: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">External URL</label>
                    <input
                      value={scholarshipForm.externalUrl}
                      onChange={(e) => setScholarshipForm((prev) => ({ ...prev, externalUrl: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={scholarshipForm.isPartial}
                        onChange={(e) => setScholarshipForm((prev) => ({ ...prev, isPartial: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      Partial scholarship
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={scholarshipForm.isActive}
                        onChange={(e) => setScholarshipForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      Active
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={submitScholarship}
                    disabled={savingScholarship}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingScholarship ? "Saving..." : editingScholarshipId ? "Update Scholarship" : "Create Scholarship"}
                  </button>
                  {editingScholarshipId && (
                    <button
                      onClick={resetScholarshipForm}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Existing Scholarships</h3>
                {scholarships.length === 0 ? (
                  <p className="text-sm text-slate-500">No scholarships configured yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-600">
                          <th className="py-2 pr-3">Name</th>
                          <th className="py-2 pr-3">Course</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Deadline</th>
                          <th className="py-2 pr-3">Applications</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scholarships.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-2 pr-3 font-medium text-slate-900">{item.name}</td>
                            <td className="py-2 pr-3">{item.course?.name || "University-wide"}</td>
                            <td className="py-2 pr-3">
                              {item.amountType === "PERCENTAGE"
                                ? `${item.amount}% (${item.percentageOf || "TOTAL"})`
                                : `${item.currency} ${item.amount.toLocaleString()}`}
                            </td>
                            <td className="py-2 pr-3">{item.deadline ? new Date(item.deadline).toLocaleDateString("en-GB") : "-"}</td>
                            <td className="py-2 pr-3">{item._count?.applications ?? 0}</td>
                            <td className="py-2 pr-3">
                              <span className={`rounded-full px-2 py-1 text-xs ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {item.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="py-2">
                              <button
                                onClick={() => startEditScholarship(item)}
                                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "commission" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                  <h3 className="text-lg font-semibold text-slate-900">Commission Agreement</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">University Commission Rate %</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step="0.01"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">Maximum allowed: 30%</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Agreement Start Date</label>
                    <input
                      type="date"
                      value={agreementStartDate}
                      onChange={(e) => setAgreementStartDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Agreement End Date (optional)</label>
                    <input
                      type="date"
                      value={agreementEndDate}
                      onChange={(e) => setAgreementEndDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={agreementNotes}
                      onChange={(e) => setAgreementNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    onClick={saveCommissionAgreement}
                    disabled={savingAgreement}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingAgreement ? "Saving..." : "Save Agreement"}
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Agreement History</h3>
                  {commissionHistory.length === 0 ? (
                    <p className="text-sm text-slate-500">No past rate changes yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto">
                      {commissionHistory.map((item) => {
                        let details: { previous?: { commissionRate?: number }; next?: { commissionRate?: number } } = {};
                        try {
                          details = item.details ? JSON.parse(item.details) : {};
                        } catch {
                          details = {};
                        }

                        return (
                          <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                            <p className="font-medium text-slate-800">
                              {details.previous?.commissionRate ?? "—"}% → {details.next?.commissionRate ?? "—"}%
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(item.createdAt).toLocaleString()} • {item.user.name || item.user.email}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="text-center py-8 text-slate-500">
              <p>Application Stats — coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
