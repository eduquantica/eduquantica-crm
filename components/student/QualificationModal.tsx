"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { QualType } from "@prisma/client";
import { toast } from "sonner";

type SubjectRow = {
  id: string;
  subjectName: string;
  rawGrade: string;
  gradeType: "GPA" | "LETTER";
  confidence: number;
};

type ExistingQualification = {
  id: string;
  qualType?: string;
  qualName: string;
  institutionName: string | null;
  yearCompleted: number | null;
  overallGrade: string | null;
  subjects: Array<{
    id?: string;
    subjectName: string;
    rawGrade: string | null;
    gradeType: "GPA" | "LETTER";
  }>;
};

interface QualificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: ExistingQualification | null;
  studentId: string;
  onSuccess: () => void;
}

const GPA_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.25", "4.5", "4.75", "5.0"];
const LETTER_OPTIONS = ["A*", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];

const QUAL_OPTIONS = [
  {
    label: "Secondary",
    items: ["SSC", "O-Level", "GCSE", "IGCSE", "Grade 10/Year 10", "Dakhil", "Other Secondary"],
  },
  {
    label: "Higher Secondary",
    items: ["HSC", "A-Level", "IAL", "Grade 12/Year 12", "Alim", "IB", "BTEC Level 3", "Foundation", "Other Higher Secondary"],
  },
  {
    label: "Undergraduate",
    items: ["BA", "BSc", "BBA", "BEng", "LLB", "MBBS", "HND", "Associate Degree", "Other Undergraduate"],
  },
  {
    label: "Postgraduate",
    items: ["MA", "MSc", "MBA", "MEng", "LLM", "MPhil", "PG Diploma", "PG Certificate", "Other Postgraduate"],
  },
  {
    label: "Doctoral",
    items: ["PhD", "DBA", "Other Doctoral"],
  },
  {
    label: "Professional",
    items: ["BTEC Level 2/4/5", "ACCA", "CPA", "CFA", "Diploma", "Certificate", "NVQ", "Other Professional"],
  },
];

function inferGradeType(value: string): "GPA" | "LETTER" {
  const num = Number(value.trim());
  if (!Number.isNaN(num) && num >= 0 && num <= 5) {
    return "GPA";
  }
  return "LETTER";
}

function newRow(subjectName = "", rawGrade = "", confidence = 0.5, gradeType: "GPA" | "LETTER" = "LETTER"): SubjectRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    subjectName,
    rawGrade,
    gradeType,
    confidence,
  };
}

function splitInstitutionAndCountry(value: string | null): { institutionName: string; countryOfStudy: string } {
  if (!value) {
    return { institutionName: "", countryOfStudy: "" };
  }

  const parts = value.split(" | ");
  if (parts.length < 2) {
    return { institutionName: value, countryOfStudy: "" };
  }

  return {
    institutionName: parts[0] || "",
    countryOfStudy: parts.slice(1).join(" | "),
  };
}

function composeInstitution(institutionName: string, countryOfStudy: string): string | null {
  const institution = institutionName.trim();
  const country = countryOfStudy.trim();
  if (!institution && !country) return null;
  if (!country) return institution;
  if (!institution) return country;
  return `${institution} | ${country}`;
}

function isYear10Or12(label: string): boolean {
  const normalized = label.toLowerCase();
  return normalized.includes("year 10") || normalized.includes("grade 10") || normalized.includes("year 12") || normalized.includes("grade 12");
}

function isKnownQualification(label: string): boolean {
  return QUAL_OPTIONS.some((group) => group.items.includes(label));
}

function mapSelectionToQualType(label: string, fallback?: string): QualType {
  const normalized = label.toLowerCase();
  if (normalized.includes("a-level") || normalized === "ial") return "A_LEVEL";
  if (normalized.includes("o-level") || normalized.includes("igcse") || normalized.includes("year 10") || normalized.includes("grade 10")) return "O_LEVEL";
  if (normalized === "gcse") return "GCSE";
  if (normalized === "ssc") return "SSC";
  if (normalized === "hsc") return "HSC";
  if (normalized === "ib") return "IB";
  if (normalized.includes("foundation")) return "FOUNDATION";
  if (fallback && Object.values(QualType).includes(fallback as QualType)) return fallback as QualType;
  return "OTHER";
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("files", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = await res.json() as { urls?: string[]; error?: string };
  if (!res.ok || !json.urls?.[0]) {
    throw new Error(json.error || "Upload failed");
  }
  return json.urls[0];
}

export default function QualificationModal({
  isOpen,
  onClose,
  existingData = null,
  studentId,
  onSuccess,
}: QualificationModalProps) {
  const [step, setStep] = useState(1);
  const [qualSelection, setQualSelection] = useState("");
  const [otherQualText, setOtherQualText] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [countryOfStudy, setCountryOfStudy] = useState("");
  const [yearCompleted, setYearCompleted] = useState<number | "">("");
  const [overallGrade, setOverallGrade] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [ocrRows, setOcrRows] = useState<SubjectRow[]>([newRow()]);
  const [manualRows, setManualRows] = useState<Array<{ subjectName: string; rawGrade: string }>>([{ subjectName: "", rawGrade: "" }]);
  const [qualificationGradeType, setQualificationGradeType] = useState<"GPA" | "LETTER">("LETTER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLabel = useMemo(() => {
    if (qualSelection === "Other (free text)") return otherQualText.trim();
    return qualSelection;
  }, [otherQualText, qualSelection]);

  useEffect(() => {
    if (!isOpen) return;

    const split = splitInstitutionAndCountry(existingData?.institutionName || null);
    const subjectRows = existingData?.subjects?.length
      ? existingData.subjects.map((subject) =>
          newRow(subject.subjectName, subject.rawGrade || "", 0.5, subject.gradeType || inferGradeType(subject.rawGrade || "")),
        )
      : [newRow()];

    if (existingData?.qualName) {
      if (isKnownQualification(existingData.qualName)) {
        setQualSelection(existingData.qualName);
        setOtherQualText("");
      } else {
        setQualSelection("Other (free text)");
        setOtherQualText(existingData.qualName);
      }
    } else {
      setQualSelection("");
      setOtherQualText("");
    }

    setStep(1);
    setInstitutionName(split.institutionName);
    setCountryOfStudy(split.countryOfStudy);
    setYearCompleted(existingData?.yearCompleted ?? "");
    setOverallGrade(existingData?.overallGrade || "");
    setTranscriptFile(null);
    setCertificateFile(null);
    setOcrRows(subjectRows);
    setManualRows(
      subjectRows.length > 0
        ? subjectRows.map((row) => ({ subjectName: row.subjectName, rawGrade: row.rawGrade }))
        : [{ subjectName: "", rawGrade: "" }],
    );
    setQualificationGradeType(subjectRows[0]?.gradeType || "LETTER");
    setSaving(false);
    setError(null);
  }, [existingData, isOpen]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!selectedLabel) {
      setError("Qualification type is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const qualType = mapSelectionToQualType(selectedLabel, existingData?.qualType);
      const subjects = ocrRows
        .map((row) => ({
          subjectName: row.subjectName.trim(),
          rawGrade: row.rawGrade.trim(),
          gradeType: row.gradeType,
          confidence: row.confidence,
        }))
        .filter((row) => row.subjectName);

      let qualificationId = existingData?.id || "";

      if (!qualificationId) {
        const createRes = await fetch(`/api/admin/students/${studentId}/qualifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qualType,
            qualName: selectedLabel,
            institutionName: composeInstitution(institutionName, countryOfStudy),
            yearCompleted: yearCompleted === "" ? null : Number(yearCompleted),
            overallGrade: overallGrade.trim() || null,
          }),
        });
        const createJson = await createRes.json() as { data?: { id?: string }; error?: string };
        if (!createRes.ok || !createJson.data?.id) {
          throw new Error(createJson.error || "Failed to create qualification");
        }
        qualificationId = createJson.data.id;
      }

      const patchPayload: {
        qualType: QualType;
        qualName: string;
        institutionName: string;
        countryOfStudy: string;
        yearCompleted: number | null;
        overallGrade: string | null;
        subjects?: Array<{ subjectName: string; rawGrade: string; gradeType: "GPA" | "LETTER"; confidence: number }>;
        fileUrl?: string;
        fileName?: string;
        certificateFileUrl?: string;
        certificateFileName?: string;
      } = {
        qualType,
        qualName: selectedLabel,
        institutionName,
        countryOfStudy,
        yearCompleted: yearCompleted === "" ? null : Number(yearCompleted),
        overallGrade: overallGrade.trim() || null,
      };

      if (subjects.length > 0) {
        patchPayload.subjects = subjects;
      }
      if (transcriptFile) {
        patchPayload.fileUrl = await uploadFile(transcriptFile);
        patchPayload.fileName = transcriptFile.name;
      }
      if (certificateFile) {
        patchPayload.certificateFileUrl = await uploadFile(certificateFile);
        patchPayload.certificateFileName = certificateFile.name;
      }

      const patchRes = await fetch(`/api/qualifications/${qualificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      });
      const patchJson = await patchRes.json() as { error?: string };
      if (!patchRes.ok) {
        throw new Error(patchJson.error || "Failed to save qualification");
      }

      toast.success(existingData ? "Qualification updated" : "Qualification added");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save qualification");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {existingData ? "Edit Qualification" : "Add Qualification"} (Step {step}/4)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Qualification Type</label>
                <select
                  value={qualSelection}
                  onChange={(event) => setQualSelection(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select qualification</option>
                  {QUAL_OPTIONS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="Other (free text)">Other (free text)</option>
                </select>
              </div>

              {qualSelection === "Other (free text)" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Other Qualification</label>
                  <input
                    value={otherQualText}
                    onChange={(event) => setOtherQualText(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedLabel}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Institution name</label>
                  <input value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Country of study</label>
                  <input value={countryOfStudy} onChange={(event) => setCountryOfStudy(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Year of completion</label>
                  <input type="number" value={yearCompleted} onChange={(event) => setYearCompleted(event.target.value === "" ? "" : Number(event.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Overall GPA/Grade</label>
                <input value={overallGrade} onChange={(event) => setOverallGrade(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>

              {isYear10Or12(selectedLabel) && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-800">Year 10/12 Subject Grades</p>
                  <div className="mt-3 space-y-2">
                    {manualRows.map((row, index) => (
                      <div key={`${index}-${row.subjectName}`} className="grid gap-2 md:grid-cols-6">
                        <input
                          value={row.subjectName}
                          onChange={(event) => {
                            const next = [...manualRows];
                            next[index] = { ...next[index], subjectName: event.target.value };
                            setManualRows(next);
                          }}
                          placeholder="Subject"
                          className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <input
                          value={row.rawGrade}
                          onChange={(event) => {
                            const next = [...manualRows];
                            next[index] = { ...next[index], rawGrade: event.target.value };
                            setManualRows(next);
                          }}
                          placeholder="Grade"
                          className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setManualRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualRows((prev) => [...prev, { subjectName: "", rawGrade: "" }])}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    Add Subject
                  </button>
                </div>
              )}

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isYear10Or12(selectedLabel)) {
                        const rows = manualRows
                          .filter((row) => row.subjectName.trim() || row.rawGrade.trim())
                          .map((row) => newRow(row.subjectName.trim(), row.rawGrade.trim(), 0.5, qualificationGradeType));
                        setOcrRows(rows.length > 0 ? rows : [newRow("", "", 0.5, qualificationGradeType)]);
                      }
                      setStep(3);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">Optional transcript</p>
                <p className="mt-1 text-xs text-slate-500">Upload a transcript file for this qualification.</p>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) => setTranscriptFile(event.target.files?.[0] || null)}
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {transcriptFile && <p className="mt-2 text-sm text-slate-700">Selected transcript: {transcriptFile.name}</p>}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">Optional qualification certificate</p>
                <p className="mt-1 text-xs text-slate-500">Upload if you have a separate certificate file.</p>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) => setCertificateFile(event.target.files?.[0] || null)}
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {certificateFile && <p className="mt-2 text-sm text-slate-700">Selected certificate: {certificateFile.name}</p>}
              </div>

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
                <button type="button" onClick={() => setStep(4)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Next</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Grade Type</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="qualification-grade-type"
                      value="GPA"
                      checked={qualificationGradeType === "GPA"}
                      onChange={() => {
                        setQualificationGradeType("GPA");
                        setOcrRows((prev) => prev.map((row) => ({ ...row, gradeType: "GPA", rawGrade: row.gradeType === "GPA" ? row.rawGrade : "" })));
                      }}
                    />
                    GPA Score
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="qualification-grade-type"
                      value="LETTER"
                      checked={qualificationGradeType === "LETTER"}
                      onChange={() => {
                        setQualificationGradeType("LETTER");
                        setOcrRows((prev) => prev.map((row) => ({ ...row, gradeType: "LETTER", rawGrade: row.gradeType === "LETTER" ? row.rawGrade : "" })));
                      }}
                    />
                    Letter Grade
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Subject Name</th>
                      <th className="px-3 py-2">Grade Type</th>
                      <th className="px-3 py-2">Grade</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {ocrRows.map((row, index) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <input
                            value={row.subjectName}
                            onChange={(event) => {
                              const next = [...ocrRows];
                              next[index] = { ...next[index], subjectName: event.target.value };
                              setOcrRows(next);
                            }}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.gradeType}
                            onChange={(event) => {
                              const next = [...ocrRows];
                              next[index] = { ...next[index], gradeType: event.target.value as "GPA" | "LETTER", rawGrade: "" };
                              setOcrRows(next);
                            }}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                          >
                            <option value="GPA">GPA Score</option>
                            <option value="LETTER">Letter Grade</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {row.gradeType === "GPA" ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={5}
                                step="0.01"
                                list={`qualification-gpa-${row.id}`}
                                value={row.rawGrade}
                                onChange={(event) => {
                                  const next = [...ocrRows];
                                  next[index] = { ...next[index], rawGrade: event.target.value };
                                  setOcrRows(next);
                                }}
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                              />
                              <datalist id={`qualification-gpa-${row.id}`}>
                                {GPA_OPTIONS.map((gpa) => (
                                  <option key={gpa} value={gpa} />
                                ))}
                              </datalist>
                            </>
                          ) : (
                            <select
                              value={row.rawGrade}
                              onChange={(event) => {
                                const next = [...ocrRows];
                                next[index] = { ...next[index], rawGrade: event.target.value };
                                setOcrRows(next);
                              }}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                            >
                              <option value="">Select</option>
                              {LETTER_OPTIONS.map((grade) => (
                                <option key={grade} value={grade}>{grade}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setOcrRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => setOcrRows((prev) => [...prev, newRow("", "", 0.5, qualificationGradeType)])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Add Missing Subject
              </button>

              <div className="flex flex-wrap justify-between gap-3">
                <button type="button" onClick={() => setStep(3)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Qualification
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}