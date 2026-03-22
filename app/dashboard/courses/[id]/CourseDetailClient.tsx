"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, DollarSign, Users, Award } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/cn";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import AdmissionRequirementsTab from "./AdmissionRequirementsTab";

interface CourseDetail {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  duration: string | null;
  studyMode: string;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  tags: string[];
  description: string | null;
  curriculum: string | null;
  isActive: boolean;
  intakeDatesWithDeadlines: { date: string; deadline: string }[];
  totalEnrolledStudents: number;
  completionRate: number | null;
  createdAt: string;
  updatedAt: string;
  universityId: string;
  university: {
    id: string;
    name: string;
    country: string;
    city: string | null;
    logo: string | null;
    website: string | null;
    description: string | null;
    currency: string;
  };
  totalApplications: number;
  activeScholarships: number;
}

interface SimilarProgram {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string | null;
  tuitionFee: number | null;
  currency: string;
  universityId: string;
  university: { name: string; country: string };
}

interface MatchedStudentRow {
  id: string;
  studentId: string;
  matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
  matchScore: number;
  missingSubjects: string[];
  weakSubjects: string[];
  overallMet: boolean;
  englishMet: boolean | null;
  counsellorFlagNote: string | null;
  hasApplication: boolean;
  applicationId: string | null;
  applicationStatus: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    nationality: string | null;
    assignedCounsellor: {
      id: string;
      name: string | null;
    } | null;
  };
}

interface CourseScholarship {
  id: string;
  name: string;
  amount: number;
  amountType: "FIXED" | "PERCENTAGE";
  percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
  currency: string;
  deadline: string | null;
  intakePeriod: string | null;
  eligibilityCriteria: string;
  isPartial: boolean;
  applicationProcess: string | null;
  externalUrl: string | null;
  minAcademicScore: number | null;
  minEnglishScore: number | null;
  course: { id: string; name: string } | null;
  _count?: { applications: number };
}

interface CourseDetailClientProps {
  courseId: string;
}

const TAG_LABELS: Record<string, string> = {
  FAST_ACCEPTANCE: "Fast Acceptance",
  INSTANT_OFFER: "Instant Offer",
  POPULAR: "Popular",
  HIGH_JOB_DEMAND: "High Job Demand",
  TOP: "Top",
  PRIME: "Prime",
  NO_VISA_CAP: "No Visa Cap",
  LOANS_AVAILABLE: "Loans Available",
};

const INTAKE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-green-100 text-green-700" },
  LIKELY_OPEN: { label: "Likely Open", color: "bg-yellow-100 text-yellow-700" },
  CLOSED: { label: "Closed", color: "bg-red-100 text-red-700" },
};

function getIntakeStatus(deadline: string): "OPEN" | "LIKELY_OPEN" | "CLOSED" {
  const deadlineDate = new Date(deadline);
  const today = new Date();
  const daysUntilDeadline = Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDeadline < 0) return "CLOSED";
  if (daysUntilDeadline <= 30) return "LIKELY_OPEN";
  return "OPEN";
}

export default function CourseDetailClient({ courseId }: CourseDetailClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, error } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/courses/${courseId}`);
      if (!res.ok) throw new Error("Failed to fetch course");
      const json = await res.json();
      return json.data;
    },
  });

  const course: CourseDetail | undefined = data?.course;
  const similarPrograms: SimilarProgram[] = data?.similarPrograms || [];
  const {
    data: matchedStudents = [],
    isLoading: matchedStudentsLoading,
    isError: matchedStudentsError,
  } = useQuery<MatchedStudentRow[]>({
    queryKey: ["course-matched-students", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/courses/${courseId}/matched-students`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch matched students");
      const json = await res.json();
      return json.data || [];
    },
    enabled: activeTab === "matched",
  });

  const {
    data: scholarships = [],
    isLoading: scholarshipsLoading,
    isError: scholarshipsError,
  } = useQuery<CourseScholarship[]>({
    queryKey: ["course-scholarships", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/universities/${course?.universityId}/scholarships`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load scholarships");
      const rows = (json.data || []) as CourseScholarship[];
      return rows.filter((row) => row.course?.id === courseId || row.course === null);
    },
    enabled: activeTab === "scholarships" && Boolean(course?.universityId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">Failed to load course details</p>
      </div>
    );
  }

  const intakes = course.intakeDatesWithDeadlines || [];
  const nextIntake = intakes[0];

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/courses" className="p-2 hover:bg-gray-100 rounded-md">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{course.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {course.university.name} • {course.university.country}
          </p>
        </div>
        <Link
          href={`/dashboard/courses/${courseId}/edit`}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Edit size={16} />
          Edit
        </Link>
      </div>

      {/* Status and Tags */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-block rounded-full px-3 py-1 text-sm font-medium",
            course.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
          )}
        >
          {course.isActive ? "Active" : "Inactive"}
        </span>
        {course.tags.map((tag) => (
          <span key={tag} className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
            {TAG_LABELS[tag] || tag}
          </span>
        ))}
      </div>

      {/* Quick Info Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <p className="text-xs font-medium text-gray-600">Level</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{course.level}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Duration</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{course.duration || "-"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Tuition Fee</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {course.tuitionFee ? (
              <CurrencyDisplay
                amount={course.tuitionFee}
                baseCurrency={course.currency}
              />
            ) : "N/A"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Next Intake</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{nextIntake?.date || "N/A"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Application Fee</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {course.applicationFee ? (
              <CurrencyDisplay
                amount={course.applicationFee}
                baseCurrency={course.currency}
              />
            ) : "Free"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-8">
              {[
                { id: "overview", label: "Overview" },
                { id: "requirements", label: "Admission Requirements" },
                { id: "matched", label: "Matched Students" },
                { id: "scholarships", label: "Scholarships" },
                { id: "similar", label: "Similar Programs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "border-b-2 px-1 py-4 text-sm font-medium transition",
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {course.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Course Description</h3>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{course.description}</p>
                  </div>
                )}

                {course.curriculum && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Curriculum & Modules</h3>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{course.curriculum}</p>
                  </div>
                )}

                {!course.description && !course.curriculum && (
                  <p className="text-gray-500 italic">No course information available yet.</p>
                )}
              </div>
            )}

            {/* Admission Requirements Tab */}
            {activeTab === "requirements" && (
              <AdmissionRequirementsTab courseId={courseId} />
            )}

            {activeTab === "matched" && (
              <div className="space-y-4">
                {matchedStudentsLoading ? (
                  <p className="text-sm text-gray-500">Loading matched students...</p>
                ) : matchedStudentsError ? (
                  <p className="text-sm text-red-600">Failed to load matched students.</p>
                ) : matchedStudents.length === 0 ? (
                  <p className="text-sm text-gray-500">No matched students found for this course.</p>
                ) : (
                  <div className="space-y-3">
                    {matchedStudents.map((row) => (
                      <div key={row.id} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Link href={`/dashboard/students/${row.student.id}`} className="font-semibold text-gray-900 hover:text-blue-700">
                              {row.student.firstName} {row.student.lastName}
                            </Link>
                            <p className="text-xs text-gray-600">
                              {row.student.nationality || "Nationality not set"}
                              {row.student.assignedCounsellor?.name ? ` • Counsellor: ${row.student.assignedCounsellor.name}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={cn(
                                "inline-block rounded-full px-3 py-1 text-xs font-semibold",
                                row.matchStatus === "FULL_MATCH"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : row.matchStatus === "PENDING"
                                    ? "bg-blue-100 text-blue-700"
                                  : row.matchStatus === "PARTIAL_MATCH"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {row.matchStatus === "FULL_MATCH"
                                ? "Eligible"
                                : row.matchStatus === "PENDING"
                                  ? "Pending"
                                : row.matchStatus === "PARTIAL_MATCH"
                                  ? "Partial Match"
                                  : "Not Eligible"}
                            </span>
                            <p className="mt-1 text-xs text-gray-600">Score: {row.matchScore.toFixed(1)}</p>
                          </div>
                        </div>

                        {(row.missingSubjects.length > 0 || row.weakSubjects.length > 0) && (
                          <div className="mt-3 text-xs text-gray-600 space-y-1">
                            {row.missingSubjects.length > 0 && <p>Missing: {row.missingSubjects.join(", ")}</p>}
                            {row.weakSubjects.length > 0 && <p>Weak: {row.weakSubjects.join(", ")}</p>}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/students/${row.student.id}`}
                            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Open Student
                          </Link>
                          {row.hasApplication && row.applicationId ? (
                            <Link
                              href={`/dashboard/applications/${row.applicationId}`}
                              className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              View Application
                            </Link>
                          ) : (
                            <Link
                              href={`/dashboard/applications/new?studentId=${row.student.id}&courseId=${courseId}`}
                              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Create Application
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scholarships Tab */}
            {activeTab === "scholarships" && (
              <div className="space-y-4">
                {scholarshipsLoading ? (
                  <p className="text-sm text-gray-500">Loading scholarships...</p>
                ) : scholarshipsError ? (
                  <p className="text-sm text-red-600">Failed to load scholarships.</p>
                ) : scholarships.length === 0 ? (
                  <p className="text-sm text-gray-500">No active scholarships found for this course.</p>
                ) : (
                  scholarships.map((scholarship) => (
                    <article key={scholarship.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-gray-900">{scholarship.name}</h4>
                          <p className="mt-1 text-xs text-gray-600">
                            {scholarship.isPartial ? "Partial scholarship" : "Full scholarship"}
                            {scholarship.intakePeriod ? ` • ${scholarship.intakePeriod}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          {scholarship.amountType === "PERCENTAGE" ? (
                            <p className="text-sm font-semibold text-gray-900">{scholarship.amount}% ({scholarship.percentageOf || "TOTAL"})</p>
                          ) : (
                            <p className="text-sm font-semibold text-gray-900">
                              <CurrencyDisplay amount={scholarship.amount} baseCurrency={scholarship.currency || course.currency} />
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {scholarship.deadline ? `Deadline: ${new Date(scholarship.deadline).toLocaleDateString("en-GB")}` : "No deadline"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{scholarship.eligibilityCriteria}</p>

                      {(scholarship.minAcademicScore != null || scholarship.minEnglishScore != null) && (
                        <p className="mt-2 text-xs text-gray-600">
                          {scholarship.minAcademicScore != null ? `Min academic: ${scholarship.minAcademicScore}` : ""}
                          {scholarship.minAcademicScore != null && scholarship.minEnglishScore != null ? " • " : ""}
                          {scholarship.minEnglishScore != null ? `Min English: ${scholarship.minEnglishScore}` : ""}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          Applications: {scholarship._count?.applications ?? 0}
                        </span>
                        {scholarship.externalUrl && (
                          <a href={scholarship.externalUrl} target="_blank" rel="noreferrer" className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
                            External Link
                          </a>
                        )}
                        <Link href={`/dashboard/universities/${course.universityId}`} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                          Manage at University
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}

            {/* Similar Programs Tab */}
            {activeTab === "similar" && (
              <div className="space-y-4">
                {similarPrograms.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No similar programs found</p>
                ) : (
                  <div className="grid gap-4">
                    {similarPrograms.map((program) => (
                      <Link
                        key={program.id}
                        href={`/dashboard/courses/${program.id}`}
                        className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition"
                      >
                        <h4 className="font-semibold text-gray-900">{program.name}</h4>
                        <p className="mt-1 text-sm text-gray-600">
                          {program.university.name} • {program.university.country}
                        </p>
                        <p className="mt-2 flex items-center justify-between">
                          <span className="text-sm text-gray-600">{program.level}</span>
                          <span className="font-medium text-gray-900">
                            {program.tuitionFee ? (
                              <CurrencyDisplay
                                amount={program.tuitionFee}
                                baseCurrency={program.currency}
                              />
                            ) : "-"}
                          </span>
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Program Details Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Level:</span>
                <span className="font-medium text-gray-900">{course.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">{course.duration || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Study Mode:</span>
                <span className="font-medium text-gray-900">{course.studyMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Field of Study:</span>
                <span className="font-medium text-gray-900">{course.fieldOfStudy || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Location:</span>
                <span className="font-medium text-gray-900">
                  {course.university.city || course.university.country}
                </span>
              </div>
              <hr className="my-3" />
              <div className="flex justify-between">
                <span className="text-gray-600">Gross Tuition:</span>
                <span className="font-medium text-gray-900">
                  {course.tuitionFee ? (
                    <CurrencyDisplay
                      amount={course.tuitionFee}
                      baseCurrency={course.currency}
                    />
                  ) : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Application Fee:</span>
                <span className="font-medium text-gray-900">
                  {course.applicationFee ? `${course.currency} ${course.applicationFee}` : "Free"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Degree Level:</span>
                <span className="font-medium text-gray-900">{course.level}</span>
              </div>
            </div>
          </div>

          {/* Program Statistics */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600">Enrolled Students</p>
                  <p className="text-lg font-semibold text-gray-900">{course.totalEnrolledStudents}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Completion Rate</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {course.completionRate ? `${course.completionRate}%` : "N/A"}
                  </span>
                </div>
                {course.completionRate !== null && (
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition"
                      style={{ width: `${course.completionRate}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Program Intakes */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Intakes</h3>
            {intakes.length === 0 ? (
              <p className="text-sm text-gray-500">No intake dates configured</p>
            ) : (
              <div className="space-y-3">
                {intakes.map((intake, index) => {
                  const status = getIntakeStatus(intake.deadline);
                  const statusConfig = INTAKE_STATUS_LABELS[status];
                  return (
                    <div key={index} className="rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{intake.date}</span>
                        <span className={cn("text-xs font-medium px-2 py-1 rounded", statusConfig.color)}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">Deadline: {intake.deadline}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              <DollarSign size={16} />
              Financial Calculator
            </button>
            <button className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition">
              <Award size={16} />
              Create Application
            </button>
          </div>

          {/* Last Updated */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200">
            <p>Last updated: {formatDistanceToNow(new Date(course.updatedAt), { addSuffix: true })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
