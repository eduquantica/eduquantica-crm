"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface University {
  id: string;
  name: string;
  currency: string;
  country: string;
}

interface IntakeDate {
  date: string;
  deadline: string;
}

const LEVEL_OPTIONS = [
  { value: "FOUNDATION", label: "Foundation" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "BACHELORS", label: "Undergraduate" },
  { value: "MASTERS", label: "Postgraduate" },
  { value: "PHD", label: "PhD" },
];

const STUDY_MODE_OPTIONS = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "ONLINE", label: "Online" },
];

const COMMON_FIELDS_OF_STUDY = [
  "Business & Management",
  "Engineering",
  "Computer Science",
  "Life Sciences",
  "Medicine & Health",
  "Arts & Humanities",
  "Social Sciences",
  "Law",
  "Education",
  "Psychology",
  "Economics",
  "Architecture",
  "Fashion & Design",
  "Hospitality & Tourism",
  "Environmental Science",
];

const COURSE_TAGS = [
  { value: "FAST_ACCEPTANCE", label: "Fast Acceptance" },
  { value: "INSTANT_OFFER", label: "Instant Offer" },
  { value: "POPULAR", label: "Popular" },
  { value: "HIGH_JOB_DEMAND", label: "High Job Demand" },
  { value: "TOP", label: "Top" },
  { value: "PRIME", label: "Prime" },
  { value: "NO_VISA_CAP", label: "No Visa Cap" },
  { value: "LOANS_AVAILABLE", label: "Loans Available" },
];

interface AddCourseFormProps {
  universities: University[];
}

export default function AddCourseForm({ universities }: AddCourseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showFieldInput, setShowFieldInput] = useState(false);
  const [newField, setNewField] = useState("");

  // Form state
  const [universityId, setUniversityId] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [duration, setDuration] = useState("");
  const [studyMode, setStudyMode] = useState("FULL_TIME");
  const [tuitionFee, setTuitionFee] = useState("");
  const [applicationFee, setApplicationFee] = useState("");
  const [description, setDescription] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [intakeDates, setIntakeDates] = useState<IntakeDate[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const selectedUniversity = universities.find((u) => u.id === universityId);
  const currency = selectedUniversity?.currency || "GBP";

  const handleAddIntake = () => {
    setIntakeDates([...intakeDates, { date: "", deadline: "" }]);
  };

  const handleRemoveIntake = (index: number) => {
    setIntakeDates(intakeDates.filter((_, i) => i !== index));
  };

  const handleIntakeDateChange = (index: number, field: string, value: string) => {
    const updated = [...intakeDates];
    updated[index] = { ...updated[index], [field]: value };
    setIntakeDates(updated);
  };

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleAddCustomField = () => {
    if (newField.trim()) {
      setFieldOfStudy(newField);
      setNewField("");
      setShowFieldInput(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!universityId || !name || !level || !fieldOfStudy) {
        throw new Error("Please fill in all required fields");
      }

      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId,
          name,
          level,
          fieldOfStudy,
          duration: duration || undefined,
          studyMode,
          tuitionFee: tuitionFee ? parseFloat(tuitionFee) : undefined,
          applicationFee: applicationFee ? parseFloat(applicationFee) : undefined,
          description: description || undefined,
          curriculum: curriculum || undefined,
          tags: selectedTags,
          intakeDatesWithDeadlines: intakeDates.length > 0 ? intakeDates : undefined,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create course");
      }

      const data = await res.json();
      router.push(`/dashboard/courses/${data.data.course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/courses" className="p-2 hover:bg-gray-100 rounded-md">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-bold">Add New Course</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* University */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                University <span className="text-red-500">*</span>
              </label>
              <select
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Select University</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.country})
                  </option>
                ))}
              </select>
            </div>

            {/* Course Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BSc Computer Science"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Select Level</option>
                {LEVEL_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Field of Study */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field of Study <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Field</option>
                  {COMMON_FIELDS_OF_STUDY.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowFieldInput(!showFieldInput)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus size={16} />
                  New
                </button>
              </div>
              {showFieldInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newField}
                    onChange={(e) => setNewField(e.target.value)}
                    placeholder="Enter custom field"
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Program Details */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Program Details</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 3 years"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Study Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Study Mode</label>
              <select
                value={studyMode}
                onChange={(e) => setStudyMode(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {STUDY_MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex items-end">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Financial Information */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Financial Information</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Gross Tuition Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gross Tuition Fee ({currency})
              </label>
              <input
                type="number"
                value={tuitionFee}
                onChange={(e) => setTuitionFee(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Application Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Application Fee ({currency})
              </label>
              <input
                type="number"
                value={applicationFee}
                onChange={(e) => setApplicationFee(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Description & Curriculum */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a detailed description of the course..."
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curriculum / Modules
            </label>
            <textarea
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              placeholder="List the modules and curriculum details..."
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Section 5: Intake Dates */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Intake Dates & Deadlines</h2>
            <button
              type="button"
              onClick={handleAddIntake}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Intake
            </button>
          </div>

          {intakeDates.length === 0 ? (
            <p className="text-sm text-gray-500">No intake dates added yet</p>
          ) : (
            <div className="space-y-4">
              {intakeDates.map((intake, index) => (
                <div key={index} className="flex gap-4 items-end rounded-lg bg-gray-50 p-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Intake Date (YYYY-MM)
                    </label>
                    <input
                      type="month"
                      value={intake.date}
                      onChange={(e) => handleIntakeDateChange(index, "date", e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Application Deadline
                    </label>
                    <input
                      type="date"
                      value={intake.deadline}
                      onChange={(e) => handleIntakeDateChange(index, "deadline", e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveIntake(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 6: Tags */}
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Course Tags</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {COURSE_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() =>
                    selectedTags.includes(tag.value)
                      ? handleRemoveTag(tag.value)
                      : handleAddTag(tag.value)
                  }
                  className={cn(
                    "rounded-lg border-2 px-4 py-2 text-sm font-medium transition",
                    selectedTags.includes(tag.value)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
          >
            {isSubmitting ? "Creating..." : "Create Course"}
          </button>
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
