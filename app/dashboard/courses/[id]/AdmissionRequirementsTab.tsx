"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CountryQualificationType, ProgrammeLevel, SubjectCategory, SubjectReqType, type QualType } from "@prisma/client";
import { toast } from "sonner";
import CountryEntryRequirementsDisplay from "@/components/CountryEntryRequirementsDisplay";
import { COUNTRY_QUALIFICATION_LABELS } from "@/lib/country-qualification";
import { GradeNormaliser } from "@/lib/grade-normalisation";
import { SUBJECT_MASTER_LIST } from "@/lib/transcript-ocr";

type RequirementRow = {
  id: string;
  subjectName: string;
  minimumGrade: string;
  notes: string;
  minimumUniversal: number | "";
  requirementType: SubjectReqType;
  subjectAliases: string[];
  subjectCategory: SubjectCategory | "";
};

type QualificationTypeKey =
  | "A_LEVEL"
  | "O_LEVEL"
  | "IGCSE"
  | "GCSE"
  | "SSC"
  | "HSC"
  | "BACHELORS"
  | "MASTERS"
  | `CUSTOM:${string}`;

type QualificationSystem =
  | "GCSE_OLEVEL"
  | "A_LEVEL"
  | "SSC_HSC"
  | "WAEC_NECO"
  | "IB"
  | "PERCENTAGE"
  | "GPA_4"
  | "FOUNDATION";

type BuilderMeta = {
  systems: QualificationSystem[];
  englishBands: {
    reading: number | null;
    writing: number | null;
    listening: number | null;
    speaking: number | null;
  };
  customQualificationTypes?: string[];
  subjectRequirementsByType?: Record<string, RequirementRow[]>;
};

type CountryRequirementRow = {
  id: string;
  countryCode: string;
  programmeLevel: ProgrammeLevel;
  qualificationType: CountryQualificationType;
  minGradeDescription: string;
  minUniversalScore: number | "";
  requiredSubjects: Array<{
    id: string;
    subjectName: string;
    minimumGrade: string;
    isMandatory: boolean;
  }>;
  minimumSubjectsRequired: number | "";
  notes: string;
  alternativePathwayAccepted: boolean;
  alternativePathwayDetails: string;
  contextualOfferAvailable: boolean;
  contextualOfferDetails: string;
  englishSubjectOverride: boolean;
  englishOverrideSubjects: string;
  englishOverrideIELTS: number | "";
  ukviIeltsRequired: boolean;
  noEnglishWaiver: boolean;
  transferStudentAccepted: boolean;
  transferStudentDetails: string;
};

const SYSTEM_OPTIONS: Array<{ id: QualificationSystem; label: string }> = [
  { id: "GCSE_OLEVEL", label: "GCSE/O-Level" },
  { id: "A_LEVEL", label: "A-Level" },
  { id: "SSC_HSC", label: "SSC/HSC" },
  { id: "WAEC_NECO", label: "WAEC/NECO" },
  { id: "IB", label: "IB" },
  { id: "PERCENTAGE", label: "Percentage" },
  { id: "GPA_4", label: "GPA 4.0" },
  { id: "FOUNDATION", label: "Foundation" },
];

const SUBJECT_CATEGORY_OPTIONS: SubjectCategory[] = [
  "STEM",
  "LANGUAGE",
  "HUMANITIES",
  "ARTS",
  "BUSINESS",
  "VOCATIONAL",
  "OTHER",
];

const DEFAULT_QUALIFICATION_TYPES: QualificationTypeKey[] = [
  "A_LEVEL",
  "O_LEVEL",
  "IGCSE",
  "GCSE",
  "SSC",
  "HSC",
  "BACHELORS",
  "MASTERS",
];

const QUALIFICATION_TYPE_LABELS: Record<string, string> = {
  A_LEVEL: "A-Level",
  O_LEVEL: "O-Level",
  IGCSE: "IGCSE",
  GCSE: "GCSE",
  SSC: "SSC",
  HSC: "HSC",
  BACHELORS: "Bachelor's",
  MASTERS: "Master's",
};

const LETTER_GRADE_OPTIONS = ["A*", "A", "B", "C", "D", "E", "Pass"];

const PROGRAMME_LEVEL_OPTIONS: ProgrammeLevel[] = [
  "IFP",
  "FOUNDATION",
  "UNDERGRADUATE",
  "MASTERS",
  "MBA",
  "PHD",
  "ALL",
];

const SYSTEM_TO_QUAL_TYPES: Record<QualificationSystem, QualType[]> = {
  GCSE_OLEVEL: ["GCSE", "O_LEVEL"],
  A_LEVEL: ["A_LEVEL"],
  SSC_HSC: ["SSC", "HSC"],
  WAEC_NECO: ["WAEC", "NECO"],
  IB: ["IB"],
  PERCENTAGE: [],
  GPA_4: [],
  FOUNDATION: ["FOUNDATION"],
};

function parseBuilderMeta(additionalNotes: string | null | undefined): BuilderMeta {
  if (!additionalNotes) {
    return {
      systems: ["GCSE_OLEVEL", "A_LEVEL", "SSC_HSC", "WAEC_NECO", "IB", "FOUNDATION"],
      englishBands: { reading: null, writing: null, listening: null, speaking: null },
    };
  }

  try {
    const parsed = JSON.parse(additionalNotes) as { builderMeta?: BuilderMeta };
    if (parsed?.builderMeta) return parsed.builderMeta;
  } catch {
    return {
      systems: ["GCSE_OLEVEL", "A_LEVEL", "SSC_HSC", "WAEC_NECO", "IB", "FOUNDATION"],
      englishBands: { reading: null, writing: null, listening: null, speaking: null },
    };
  }

  return {
    systems: ["GCSE_OLEVEL", "A_LEVEL", "SSC_HSC", "WAEC_NECO", "IB", "FOUNDATION"],
    englishBands: { reading: null, writing: null, listening: null, speaking: null },
  };
}

function makeRow(): RequirementRow {
  return {
    id: `row-${Math.random().toString(36).slice(2)}`,
    subjectName: "",
    minimumGrade: "",
    notes: "",
    minimumUniversal: "",
    requirementType: "REQUIRED",
    subjectAliases: [],
    subjectCategory: "",
  };
}

function makeCountryRequirementRow(): CountryRequirementRow {
  return {
    id: `country-row-${Math.random().toString(36).slice(2)}`,
    countryCode: "",
    programmeLevel: "ALL",
    qualificationType: "OTHER",
    minGradeDescription: "",
    minUniversalScore: "",
    requiredSubjects: [],
    minimumSubjectsRequired: "",
    notes: "",
    alternativePathwayAccepted: false,
    alternativePathwayDetails: "",
    contextualOfferAvailable: false,
    contextualOfferDetails: "",
    englishSubjectOverride: false,
    englishOverrideSubjects: "",
    englishOverrideIELTS: "",
    ukviIeltsRequired: false,
    noEnglishWaiver: false,
    transferStudentAccepted: false,
    transferStudentDetails: "",
  };
}

function makeCountrySubjectRequirementRow() {
  return {
    id: `country-subject-${Math.random().toString(36).slice(2)}`,
    subjectName: "",
    minimumGrade: "",
    isMandatory: true,
  };
}

export default function AdmissionRequirementsTab({ courseId }: { courseId: string }) {
  const [selectedSystems, setSelectedSystems] = useState<QualificationSystem[]>([]);
  const [overallDescription, setOverallDescription] = useState("");
  const [overallUniversal, setOverallUniversal] = useState(55);
  const [subjectRowsByType, setSubjectRowsByType] = useState<Record<string, RequirementRow[]>>({});
  const [customQualificationTypes, setCustomQualificationTypes] = useState<string[]>([]);
  const [newCustomQualificationType, setNewCustomQualificationType] = useState("");
  const [ieltsOverall, setIeltsOverall] = useState<number | "">("");
  const [ieltsBands, setIeltsBands] = useState({
    reading: "" as number | "",
    writing: "" as number | "",
    listening: "" as number | "",
    speaking: "" as number | "",
  });
  const [toeflTotal, setToeflTotal] = useState<number | "">("");
  const [pteTotal, setPteTotal] = useState<number | "">("");
  const [countryRequirementRows, setCountryRequirementRows] = useState<CountryRequirementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcSummary, setRecalcSummary] = useState<{ PENDING: number; FULL_MATCH: number; PARTIAL_MATCH: number; NO_MATCH: number } | null>(null);
  const [showStudentPreviewModal, setShowStudentPreviewModal] = useState(false);
  const [previewNationality, setPreviewNationality] = useState("Bangladesh");
  const [previewProgrammeLevel, setPreviewProgrammeLevel] = useState<ProgrammeLevel>("UNDERGRADUATE");

  const qualificationTypeOrder = useMemo(
    () => [
      ...DEFAULT_QUALIFICATION_TYPES,
      ...customQualificationTypes.map((name) => (`CUSTOM:${name}` as QualificationTypeKey)),
    ],
    [customQualificationTypes],
  );

  function qualificationLabel(type: QualificationTypeKey): string {
    if (type.startsWith("CUSTOM:")) return type.slice(7);
    return QUALIFICATION_TYPE_LABELS[type] || type;
  }

  function gradeModeForType(type: QualificationTypeKey): "LETTER" | "GPA_5" | "GPA_4" | "TEXT" {
    if (type === "A_LEVEL" || type === "O_LEVEL" || type === "IGCSE" || type === "GCSE") return "LETTER";
    if (type === "SSC" || type === "HSC") return "GPA_5";
    if (type === "BACHELORS" || type === "MASTERS") return "GPA_4";
    return "TEXT";
  }

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/admin/courses/${courseId}/entry-requirements`);
        if (!res.ok) throw new Error("Failed to load entry requirements");
        const json = await res.json();
        const data = json.data;

        if (!data) {
          setSelectedSystems(["GCSE_OLEVEL", "A_LEVEL", "SSC_HSC", "WAEC_NECO", "IB", "FOUNDATION"]);
          const initialRows: Record<string, RequirementRow[]> = {};
          for (const type of DEFAULT_QUALIFICATION_TYPES) {
            initialRows[type] = [makeRow()];
          }
          setSubjectRowsByType(initialRows);
          setCountryRequirementRows([makeCountryRequirementRow()]);
          return;
        }

        const meta = parseBuilderMeta(data.additionalNotes);
        const systemsFromQual = new Set<QualificationSystem>(meta.systems);
        for (const qualType of (data.acceptedQualTypes ?? []) as QualType[]) {
          if (qualType === "GCSE" || qualType === "O_LEVEL") systemsFromQual.add("GCSE_OLEVEL");
          if (qualType === "A_LEVEL") systemsFromQual.add("A_LEVEL");
          if (qualType === "SSC" || qualType === "HSC") systemsFromQual.add("SSC_HSC");
          if (qualType === "WAEC" || qualType === "NECO") systemsFromQual.add("WAEC_NECO");
          if (qualType === "IB") systemsFromQual.add("IB");
          if (qualType === "FOUNDATION") systemsFromQual.add("FOUNDATION");
        }

        setSelectedSystems(Array.from(systemsFromQual));
        setOverallDescription(data.overallDescription ?? "");
        setOverallUniversal(data.overallMinUniversal ?? 55);
        setIeltsOverall(data.englishReqIelts ?? "");
        setToeflTotal(data.englishReqToefl ?? "");
        setPteTotal(data.englishReqPte ?? "");
        setIeltsBands({
          reading: meta.englishBands.reading ?? "",
          writing: meta.englishBands.writing ?? "",
          listening: meta.englishBands.listening ?? "",
          speaking: meta.englishBands.speaking ?? "",
        });
        const metaCustomTypes = Array.isArray(meta.customQualificationTypes)
          ? meta.customQualificationTypes.filter((item) => typeof item === "string" && item.trim().length > 0)
          : [];
        setCustomQualificationTypes(metaCustomTypes);

        const baseRows: Record<string, RequirementRow[]> = {};
        for (const type of DEFAULT_QUALIFICATION_TYPES) {
          baseRows[type] = [makeRow()];
        }
        for (const customType of metaCustomTypes) {
          baseRows[`CUSTOM:${customType}`] = [makeRow()];
        }

        const fromMeta = meta.subjectRequirementsByType ?? {};
        const fromMetaKeys = Object.keys(fromMeta);
        if (fromMetaKeys.length > 0) {
          for (const key of fromMetaKeys) {
            const rows = Array.isArray(fromMeta[key]) ? fromMeta[key] : [];
            baseRows[key] = rows.length
              ? rows.map((row) => ({
                  id: row.id || `row-${Math.random().toString(36).slice(2)}`,
                  subjectName: row.subjectName || "",
                  minimumGrade: row.minimumGrade || "",
                  notes: row.notes || "",
                  minimumUniversal: row.minimumUniversal ?? "",
                  requirementType: row.requirementType || "REQUIRED",
                  subjectAliases: row.subjectAliases || [],
                  subjectCategory: row.subjectCategory || "",
                }))
              : [makeRow()];
          }
        } else {
          const fallbackRows = (data.subjectRequirements ?? []).map((item: {
            id: string;
            subjectName: string;
            minimumDescription: string | null;
            minimumUniversal: number | null;
            requirementType: SubjectReqType;
            subjectAliases: string[];
            subjectCategory: SubjectCategory | null;
          }) => ({
            id: item.id,
            subjectName: item.subjectName,
            minimumGrade: item.minimumDescription ?? "",
            notes: "",
            minimumUniversal: item.minimumUniversal ?? "",
            requirementType: item.requirementType,
            subjectAliases: item.subjectAliases,
            subjectCategory: item.subjectCategory ?? "",
          }));
          baseRows.A_LEVEL = fallbackRows.length ? fallbackRows : [makeRow()];
        }

        setSubjectRowsByType(baseRows);
        const mappedCountryRows = (data.countryRequirements ?? []).map((item: {
            id: string;
            countryCode: string;
            programmeLevel: ProgrammeLevel;
            qualificationType: CountryQualificationType;
            minGradeDescription: string;
            minUniversalScore: number | null;
            requiredSubjects: Array<{
              id: string;
              subjectName: string;
              minimumGrade: string;
              isMandatory: boolean;
            }>;
            minimumSubjectsRequired: number | null;
            notes: string | null;
            alternativePathwayAccepted: boolean;
            alternativePathwayDetails: string | null;
            contextualOfferAvailable: boolean;
            contextualOfferDetails: string | null;
            englishSubjectOverride: boolean;
            englishOverrideSubjects: string | null;
            englishOverrideIELTS: string | null;
            ukviIeltsRequired: boolean;
            noEnglishWaiver: boolean;
            transferStudentAccepted: boolean;
            transferStudentDetails: string | null;
          }) => ({
            id: item.id,
            countryCode: item.countryCode,
            programmeLevel: item.programmeLevel,
            qualificationType: item.qualificationType,
            minGradeDescription: item.minGradeDescription,
            minUniversalScore: item.minUniversalScore ?? "",
            requiredSubjects: (item.requiredSubjects || []).map((subject) => ({
              id: subject.id,
              subjectName: subject.subjectName,
              minimumGrade: subject.minimumGrade,
              isMandatory: subject.isMandatory,
            })),
            minimumSubjectsRequired: item.minimumSubjectsRequired ?? "",
            notes: item.notes ?? "",
            alternativePathwayAccepted: item.alternativePathwayAccepted,
            alternativePathwayDetails: item.alternativePathwayDetails ?? "",
            contextualOfferAvailable: item.contextualOfferAvailable,
            contextualOfferDetails: item.contextualOfferDetails ?? "",
            englishSubjectOverride: item.englishSubjectOverride,
            englishOverrideSubjects: item.englishOverrideSubjects ?? "",
            englishOverrideIELTS: item.englishOverrideIELTS == null ? "" : Number(item.englishOverrideIELTS),
            ukviIeltsRequired: item.ukviIeltsRequired,
            noEnglishWaiver: item.noEnglishWaiver,
            transferStudentAccepted: item.transferStudentAccepted,
            transferStudentDetails: item.transferStudentDetails ?? "",
          }));

        setCountryRequirementRows(mappedCountryRows.length ? mappedCountryRows : [makeCountryRequirementRow()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load requirements");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [courseId]);

  const equivalencyPreview = useMemo(() => ({
    gcse: GradeNormaliser.gradeToDisplay(overallUniversal, "GCSE"),
    alevel: GradeNormaliser.gradeToDisplay(overallUniversal, "A_LEVEL"),
    ssc: GradeNormaliser.gradeToDisplay(overallUniversal, "SSC"),
    waec: GradeNormaliser.gradeToDisplay(overallUniversal, "WAEC"),
    ib: GradeNormaliser.gradeToDisplay(overallUniversal, "IB"),
    percentage: `${Math.round(overallUniversal)}%`,
  }), [overallUniversal]);

  const subjectMasterNames = useMemo(() => SUBJECT_MASTER_LIST.map((item) => item.canonicalName), []);

  function onSystemToggle(system: QualificationSystem, checked: boolean) {
    setSelectedSystems((prev) => {
      if (checked) return Array.from(new Set([...prev, system]));
      return prev.filter((item) => item !== system);
    });
  }

  function onSubjectNameChange(rowId: string, value: string) {
    setSubjectRowsByType((prev) => {
      const next: Record<string, RequirementRow[]> = {};
      for (const [typeKey, rows] of Object.entries(prev)) {
        next[typeKey] = rows.map((row) => {
          if (row.id !== rowId) return row;
          const match = SUBJECT_MASTER_LIST.find((item) => item.canonicalName.toLowerCase() === value.trim().toLowerCase());
          return {
            ...row,
            subjectName: value,
            subjectAliases: match?.aliases ?? row.subjectAliases,
            subjectCategory: match?.subjectCategory ?? row.subjectCategory,
          };
        });
      }
      return next;
    });
  }

  function updateSubjectRow(typeKey: string, rowId: string, patch: Partial<RequirementRow>) {
    setSubjectRowsByType((prev) => ({
      ...prev,
      [typeKey]: (prev[typeKey] || []).map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  }

  function addSubjectRow(typeKey: string) {
    setSubjectRowsByType((prev) => ({
      ...prev,
      [typeKey]: [...(prev[typeKey] || []), makeRow()],
    }));
  }

  function deleteSubjectRow(typeKey: string, rowId: string) {
    setSubjectRowsByType((prev) => ({
      ...prev,
      [typeKey]: (prev[typeKey] || []).filter((row) => row.id !== rowId),
    }));
  }

  function addCustomQualificationType() {
    const value = newCustomQualificationType.trim();
    if (!value) return;

    setCustomQualificationTypes((prev) => {
      if (prev.some((item) => item.toLowerCase() === value.toLowerCase())) return prev;
      return [...prev, value];
    });
    setSubjectRowsByType((prev) => {
      const key = `CUSTOM:${value}`;
      if (prev[key]) return prev;
      return { ...prev, [key]: [makeRow()] };
    });
    setNewCustomQualificationType("");
  }

  function removeCustomQualificationType(name: string) {
    const key = `CUSTOM:${name}`;
    setCustomQualificationTypes((prev) => prev.filter((item) => item !== name));
    setSubjectRowsByType((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateCountryRequirementRow(rowId: string, patch: Partial<CountryRequirementRow>) {
    setCountryRequirementRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addCountrySubjectRow(countryRowId: string) {
    setCountryRequirementRows((prev) => prev.map((row) => (
      row.id === countryRowId
        ? { ...row, requiredSubjects: [...row.requiredSubjects, makeCountrySubjectRequirementRow()] }
        : row
    )));
  }

  function updateCountrySubjectRow(
    countryRowId: string,
    subjectRowId: string,
    patch: Partial<{ subjectName: string; minimumGrade: string; isMandatory: boolean }>,
  ) {
    setCountryRequirementRows((prev) => prev.map((row) => {
      if (row.id !== countryRowId) return row;
      return {
        ...row,
        requiredSubjects: row.requiredSubjects.map((subject) => (
          subject.id === subjectRowId ? { ...subject, ...patch } : subject
        )),
      };
    }));
  }

  function removeCountrySubjectRow(countryRowId: string, subjectRowId: string) {
    setCountryRequirementRows((prev) => prev.map((row) => {
      if (row.id !== countryRowId) return row;
      return {
        ...row,
        requiredSubjects: row.requiredSubjects.filter((subject) => subject.id !== subjectRowId),
      };
    }));
  }

  function addCountryRequirementRow() {
    setCountryRequirementRows((prev) => [...prev, makeCountryRequirementRow()]);
  }

  function deleteCountryRequirementRow(rowId: string) {
    setCountryRequirementRows((prev) => prev.filter((row) => row.id !== rowId));
  }

  async function saveRequirements() {
    try {
      setIsSaving(true);
      const acceptedQualTypes = Array.from(new Set(selectedSystems.flatMap((system) => SYSTEM_TO_QUAL_TYPES[system])));
      const shouldIncludeOther = [
        ...(subjectRowsByType.BACHELORS || []),
        ...(subjectRowsByType.MASTERS || []),
        ...customQualificationTypes.flatMap((name) => subjectRowsByType[`CUSTOM:${name}`] || []),
      ].some((row) => row.subjectName.trim().length > 0 || row.minimumGrade.trim().length > 0 || row.notes.trim().length > 0);
      const finalAcceptedQualTypes = shouldIncludeOther && !acceptedQualTypes.includes("OTHER")
        ? [...acceptedQualTypes, "OTHER"]
        : acceptedQualTypes;
      const groupedSubjectRows = Object.fromEntries(
        Object.entries(subjectRowsByType).map(([typeKey, rows]) => [
          typeKey,
          rows.map((row) => ({
            id: row.id,
            subjectName: row.subjectName,
            minimumGrade: row.minimumGrade,
            notes: row.notes,
            minimumUniversal: row.minimumUniversal,
            requirementType: row.requirementType,
            subjectAliases: row.subjectAliases,
            subjectCategory: row.subjectCategory,
          })),
        ]),
      );

      const flattenedRows = Object.entries(subjectRowsByType).flatMap(([typeKey, rows]) => rows
        .filter((row) => row.subjectName.trim().length > 0)
        .map((row) => {
          const notesPart = row.notes.trim();
          const minimumPart = row.minimumGrade.trim();
          const qualLabel = qualificationLabel(typeKey as QualificationTypeKey);
          const descriptionParts = [
            minimumPart ? `Minimum grade: ${minimumPart}` : "",
            notesPart,
          ].filter(Boolean);

          return {
            subjectName: row.subjectName.trim(),
            subjectAliases: row.subjectAliases,
            subjectCategory: row.subjectCategory || null,
            minimumUniversal: row.minimumUniversal === "" ? null : Number(row.minimumUniversal),
            minimumDescription: descriptionParts.length > 0
              ? `[${qualLabel}] ${descriptionParts.join(" | ")}`
              : `[${qualLabel}]`,
            requirementType: row.requirementType,
            isAlternativeGroup: false,
            alternativeGroupId: null,
          };
        }));

      const payload = {
        acceptedQualTypes: finalAcceptedQualTypes,
        overallDescription,
        overallMinUniversal: overallUniversal,
        englishReqIelts: ieltsOverall === "" ? null : Number(ieltsOverall),
        englishReqToefl: toeflTotal === "" ? null : Number(toeflTotal),
        englishReqPte: pteTotal === "" ? null : Number(pteTotal),
        additionalNotes: JSON.stringify({
          builderMeta: {
            systems: selectedSystems,
            englishBands: {
              reading: ieltsBands.reading === "" ? null : Number(ieltsBands.reading),
              writing: ieltsBands.writing === "" ? null : Number(ieltsBands.writing),
              listening: ieltsBands.listening === "" ? null : Number(ieltsBands.listening),
              speaking: ieltsBands.speaking === "" ? null : Number(ieltsBands.speaking),
            },
            customQualificationTypes,
            subjectRequirementsByType: groupedSubjectRows,
          },
        }),
        subjectRequirements: flattenedRows,
        countryRequirements: countryRequirementRows
          .filter((row) => row.countryCode.trim().length > 0)
          .map((row) => ({
            countryCode: row.countryCode.trim().toUpperCase(),
            programmeLevel: row.programmeLevel,
            qualificationType: row.qualificationType,
            minGradeDescription: row.minGradeDescription,
            minUniversalScore: row.minUniversalScore === "" ? null : Number(row.minUniversalScore),
            requiredSubjects: row.requiredSubjects
              .filter((subject) => subject.subjectName.trim() && subject.minimumGrade.trim())
              .map((subject) => ({
                subjectName: subject.subjectName.trim(),
                minimumGrade: subject.minimumGrade.trim(),
                isMandatory: subject.isMandatory,
              })),
            minimumSubjectsRequired: row.minimumSubjectsRequired === "" ? null : Number(row.minimumSubjectsRequired),
            notes: row.notes || null,
            alternativePathwayAccepted: row.alternativePathwayAccepted,
            alternativePathwayDetails: row.alternativePathwayAccepted ? (row.alternativePathwayDetails || null) : null,
            contextualOfferAvailable: row.contextualOfferAvailable,
            contextualOfferDetails: row.contextualOfferAvailable ? (row.contextualOfferDetails || null) : null,
            englishSubjectOverride: row.englishSubjectOverride,
            englishOverrideSubjects: row.englishSubjectOverride ? (row.englishOverrideSubjects || null) : null,
            englishOverrideIELTS: row.englishSubjectOverride && row.englishOverrideIELTS !== "" ? Number(row.englishOverrideIELTS) : null,
            ukviIeltsRequired: row.ukviIeltsRequired,
            noEnglishWaiver: row.noEnglishWaiver,
            transferStudentAccepted: row.transferStudentAccepted,
            transferStudentDetails: row.transferStudentAccepted ? (row.transferStudentDetails || null) : null,
          })),
      };

      const res = await fetch(`/api/admin/courses/${courseId}/entry-requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save requirements");

      toast.success("Admission requirements saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save requirements");
    } finally {
      setIsSaving(false);
    }
  }

  async function recalculateAll() {
    try {
      setIsRecalculating(true);
      setRecalcSummary(null);
      const res = await fetch(`/api/admin/courses/${courseId}/entry-requirements/recalculate`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to recalculate eligibility");

      setRecalcSummary(json.data.summary);
      toast.success("Eligibility recalculation completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to recalculate eligibility");
    } finally {
      setIsRecalculating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading admission requirements...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">1. Accepted Qualification Systems</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SYSTEM_OPTIONS.map((system) => (
            <label key={system.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={selectedSystems.includes(system.id)}
                onChange={(event) => onSystemToggle(system.id, event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {system.label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">2. Overall Minimum Score</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Text description</label>
            <input
              value={overallDescription}
              onChange={(event) => setOverallDescription(event.target.value)}
              placeholder="Minimum 55% average or 2.5 GPA"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
              <label className="font-medium">Universal score</label>
              <span className="font-semibold text-gray-900">{overallUniversal}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={overallUniversal}
              onChange={(event) => setOverallUniversal(Number(event.target.value))}
              className="w-full"
            />
            <p className="mt-2 text-xs text-gray-600">
              At score {overallUniversal}: GCSE {equivalencyPreview.gcse} | A-Level {equivalencyPreview.alevel} | SSC GPA {equivalencyPreview.ssc} | WAEC {equivalencyPreview.waec} | IB {equivalencyPreview.ib} | Percentage {equivalencyPreview.percentage}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">3. Subject Requirements by Qualification Type</h3>
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-800">Add custom qualification type</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={newCustomQualificationType}
                onChange={(event) => setNewCustomQualificationType(event.target.value)}
                placeholder="e.g. Diploma, Advanced Diploma"
                className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addCustomQualificationType}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
                Add Type
              </button>
            </div>
          </div>

          {qualificationTypeOrder.map((typeKey) => {
            const rows = subjectRowsByType[typeKey] || [makeRow()];
            const gradeMode = gradeModeForType(typeKey);
            const label = qualificationLabel(typeKey);

            return (
              <div key={typeKey} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">{label} Subject Requirements</h4>
                  {typeKey.startsWith("CUSTOM:") && (
                    <button
                      type="button"
                      onClick={() => removeCustomQualificationType(label)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Type
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.id} className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="grid gap-3 lg:grid-cols-12">
                        <div className="lg:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-gray-700">Subject (optional)</label>
                          <input
                            list="subject-master-list"
                            value={row.subjectName}
                            onChange={(event) => onSubjectNameChange(row.id, event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="lg:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-gray-700">Minimum grade (optional)</label>
                          {gradeMode === "LETTER" ? (
                            <select
                              value={row.minimumGrade}
                              onChange={(event) => updateSubjectRow(typeKey, row.id, { minimumGrade: event.target.value })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            >
                              <option value="">Not set</option>
                              {LETTER_GRADE_OPTIONS.map((value) => (
                                <option key={`${row.id}-${value}`} value={value}>{value}</option>
                              ))}
                            </select>
                          ) : gradeMode === "GPA_5" ? (
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={5}
                              value={row.minimumGrade}
                              onChange={(event) => updateSubjectRow(typeKey, row.id, { minimumGrade: event.target.value })}
                              placeholder="GPA out of 5.0"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            />
                          ) : gradeMode === "GPA_4" ? (
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={4}
                              value={row.minimumGrade}
                              onChange={(event) => updateSubjectRow(typeKey, row.id, { minimumGrade: event.target.value })}
                              placeholder="CGPA out of 4.0"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            />
                          ) : (
                            <input
                              value={row.minimumGrade}
                              onChange={(event) => updateSubjectRow(typeKey, row.id, { minimumGrade: event.target.value })}
                              placeholder="Any grade format"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            />
                          )}
                        </div>

                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-700">Universal score</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={row.minimumUniversal}
                            onChange={(event) => updateSubjectRow(typeKey, row.id, { minimumUniversal: event.target.value === "" ? "" : Number(event.target.value) })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-700">Requirement type</label>
                          <select
                            value={row.requirementType}
                            onChange={(event) => updateSubjectRow(typeKey, row.id, { requirementType: event.target.value as SubjectReqType })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="REQUIRED">Required</option>
                            <option value="PREFERRED">Preferred</option>
                            <option value="EXCLUDED">Excluded</option>
                          </select>
                        </div>

                        <div className="lg:col-span-2 flex items-end">
                          <button
                            type="button"
                            onClick={() => deleteSubjectRow(typeKey, row.id)}
                            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600"
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <select
                            value={row.subjectCategory}
                            onChange={(event) => updateSubjectRow(typeKey, row.id, { subjectCategory: event.target.value as SubjectCategory | "" })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="">Category (optional)</option>
                            {SUBJECT_CATEGORY_OPTIONS.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <input
                            value={row.notes}
                            onChange={(event) => updateSubjectRow(typeKey, row.id, { notes: event.target.value })}
                            placeholder="Notes (optional)"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      {row.subjectAliases.length > 0 && (
                        <details className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                          <summary className="cursor-pointer text-xs font-medium text-gray-700">Known aliases</summary>
                          <p className="mt-2 text-xs text-gray-600">{row.subjectAliases.join(" • ")}</p>
                        </details>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSubjectRow(typeKey)}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add Subject Requirement
                  </button>
                </div>
              </div>
            );
          })}

          <datalist id="subject-master-list">
            {subjectMasterNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">4. English Requirements</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">IELTS Overall</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={9}
              value={ieltsOverall}
              onChange={(event) => setIeltsOverall(event.target.value === "" ? "" : Number(event.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">TOEFL Total</label>
            <input
              type="number"
              min={0}
              max={120}
              value={toeflTotal}
              onChange={(event) => setToeflTotal(event.target.value === "" ? "" : Number(event.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">PTE Total</label>
            <input
              type="number"
              min={0}
              max={90}
              value={pteTotal}
              onChange={(event) => setPteTotal(event.target.value === "" ? "" : Number(event.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">IELTS minimum per band</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["reading", "writing", "listening", "speaking"] as const).map((band) => (
              <div key={band}>
                <label className="mb-1 block text-xs font-medium capitalize text-gray-700">{band}</label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  step="0.1"
                  value={ieltsBands[band]}
                  onChange={(event) => setIeltsBands((prev) => ({
                    ...prev,
                    [band]: event.target.value === "" ? "" : Number(event.target.value),
                  }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">5. Country-Specific Requirements</h3>
        <p className="mt-2 text-sm text-gray-600">Create separate rows by country and programme level to match university international admissions rules.</p>

        <div className="mt-4 space-y-4">
          {countryRequirementRows.map((row) => (
            <div key={row.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Country</label>
                  <input
                    value={row.countryCode}
                    onChange={(event) => updateCountryRequirementRow(row.id, { countryCode: event.target.value })}
                    placeholder="BD / IN / DEFAULT"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Programme Level</label>
                  <select
                    value={row.programmeLevel}
                    onChange={(event) => updateCountryRequirementRow(row.id, { programmeLevel: event.target.value as ProgrammeLevel })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {PROGRAMME_LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Qualification</label>
                  <select
                    value={row.qualificationType}
                    onChange={(event) => updateCountryRequirementRow(row.id, { qualificationType: event.target.value as CountryQualificationType })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {Object.entries(COUNTRY_QUALIFICATION_LABELS).map(([value, label]) => (
                      <option key={`${row.id}-${value}`} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => deleteCountryRequirementRow(row.id)}
                    className="inline-flex h-10 w-full items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Minimum grade description</label>
                  <input
                    value={row.minGradeDescription}
                    onChange={(event) => updateCountryRequirementRow(row.id, { minGradeDescription: event.target.value })}
                    placeholder="e.g. HSC minimum GPA 4.0"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Universal score</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.minUniversalScore}
                    onChange={(event) => updateCountryRequirementRow(row.id, { minUniversalScore: event.target.value === "" ? "" : Number(event.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Minimum subject count</label>
                  <input
                    type="number"
                    min={0}
                    value={row.minimumSubjectsRequired}
                    onChange={(event) => updateCountryRequirementRow(row.id, { minimumSubjectsRequired: event.target.value === "" ? "" : Number(event.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
                <input
                  value={row.notes}
                  onChange={(event) => updateCountryRequirementRow(row.id, { notes: event.target.value })}
                  placeholder="Any extra context for admissions review"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 rounded-md border border-gray-200 bg-white p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Per-country subject requirements</p>
                  <button
                    type="button"
                    onClick={() => addCountrySubjectRow(row.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Subject
                  </button>
                </div>

                <div className="space-y-2">
                  {row.requiredSubjects.map((subject) => (
                    <div key={subject.id} className="grid gap-2 md:grid-cols-12">
                      <div className="md:col-span-5">
                        <input
                          list="subject-master-list"
                          value={subject.subjectName}
                          onChange={(event) => updateCountrySubjectRow(row.id, subject.id, { subjectName: event.target.value })}
                          placeholder="Subject name"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <input
                          value={subject.minimumGrade}
                          onChange={(event) => updateCountrySubjectRow(row.id, subject.id, { minimumGrade: event.target.value })}
                          placeholder="Minimum grade"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <label className="md:col-span-3 flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={subject.isMandatory}
                          onChange={(event) => updateCountrySubjectRow(row.id, subject.id, { isMandatory: event.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Mandatory
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCountrySubjectRow(row.id, subject.id)}
                        className="md:col-span-1 inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {row.requiredSubjects.length === 0 && (
                    <p className="text-xs text-gray-500">No country subject rows added yet.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-md border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alternative Pathway</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.alternativePathwayAccepted}
                    onChange={(event) => updateCountryRequirementRow(row.id, { alternativePathwayAccepted: event.target.checked })}
                  />
                  Accept alternative qualifications for this country and level
                </label>
                {row.alternativePathwayAccepted && (
                  <textarea
                    value={row.alternativePathwayDetails}
                    onChange={(event) => updateCountryRequirementRow(row.id, { alternativePathwayDetails: event.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Polytechnic Diploma with minimum 60% also accepted"
                  />
                )}
              </div>

              <div className="mt-4 space-y-3 rounded-md border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">English Requirements for this Country</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.ukviIeltsRequired}
                    onChange={(event) => updateCountryRequirementRow(row.id, { ukviIeltsRequired: event.target.checked })}
                  />
                  UKVI IELTS specifically required
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.noEnglishWaiver}
                    onChange={(event) => updateCountryRequirementRow(row.id, { noEnglishWaiver: event.target.checked })}
                  />
                  No English waiver available
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.englishSubjectOverride}
                    onChange={(event) => updateCountryRequirementRow(row.id, { englishSubjectOverride: event.target.checked })}
                  />
                  Subject-specific higher English required
                </label>
                {row.englishSubjectOverride && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={row.englishOverrideSubjects}
                      onChange={(event) => updateCountryRequirementRow(row.id, { englishOverrideSubjects: event.target.value })}
                      placeholder="Psychology, Law, Architecture"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      max={9}
                      step="0.1"
                      value={row.englishOverrideIELTS}
                      onChange={(event) => updateCountryRequirementRow(row.id, { englishOverrideIELTS: event.target.value === "" ? "" : Number(event.target.value) })}
                      placeholder="Higher IELTS score"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3 rounded-md border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contextual Offers</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.contextualOfferAvailable}
                    onChange={(event) => updateCountryRequirementRow(row.id, { contextualOfferAvailable: event.target.checked })}
                  />
                  Contextual offers available for this country
                </label>
                {row.contextualOfferAvailable && (
                  <textarea
                    value={row.contextualOfferDetails}
                    onChange={(event) => updateCountryRequirementRow(row.id, { contextualOfferDetails: event.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Applicants meeting contextual criteria may receive reduced requirements"
                  />
                )}
              </div>

              <div className="mt-4 space-y-3 rounded-md border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transfer Students</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.transferStudentAccepted}
                    onChange={(event) => updateCountryRequirementRow(row.id, { transferStudentAccepted: event.target.checked })}
                  />
                  Accept transfer students from this country
                </label>
                {row.transferStudentAccepted && (
                  <textarea
                    value={row.transferStudentDetails}
                    onChange={(event) => updateCountryRequirementRow(row.id, { transferStudentDetails: event.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Students who completed 1-2 years at Level 4/5 may be considered"
                  />
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addCountryRequirementRow}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add Country Requirement
          </button>

          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Programme Level</th>
                  <th className="px-3 py-2">Qualification</th>
                  <th className="px-3 py-2">Min Grade</th>
                  <th className="px-3 py-2">Alternative Pathway</th>
                  <th className="px-3 py-2">UKVI IELTS</th>
                  <th className="px-3 py-2">Contextual</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {countryRequirementRows.map((row) => (
                  <tr key={`table-${row.id}`} className="border-t border-gray-200">
                    <td className="px-3 py-2">{row.countryCode || "-"}</td>
                    <td className="px-3 py-2">{row.programmeLevel}</td>
                    <td className="px-3 py-2">{COUNTRY_QUALIFICATION_LABELS[row.qualificationType] || "-"}</td>
                    <td className="px-3 py-2">{row.minGradeDescription || "-"}</td>
                    <td className="px-3 py-2">{row.alternativePathwayAccepted ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{row.ukviIeltsRequired ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{row.contextualOfferAvailable ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => deleteCountryRequirementRow(row.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">6. Actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveRequirements}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Requirements
          </button>

          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Preview Requirements
          </button>

          <button
            type="button"
            onClick={() => setShowStudentPreviewModal(true)}
            className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Preview as Student
          </button>

          <button
            type="button"
            onClick={recalculateAll}
            disabled={isRecalculating}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {isRecalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            Recalculate for All Shortlisted Students
          </button>
        </div>

        {isRecalculating && (
          <p className="mt-3 text-sm text-gray-600">Recalculation in progress...</p>
        )}

        {recalcSummary && (
          <p className="mt-3 text-sm font-medium text-gray-700">
            Summary: {recalcSummary.PENDING} PENDING, {recalcSummary.FULL_MATCH} FULL_MATCH, {recalcSummary.PARTIAL_MATCH} PARTIAL_MATCH, {recalcSummary.NO_MATCH} NO_MATCH
          </p>
        )}

        {showPreview && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Student-facing requirements preview</p>
            <p className="mt-2">Accepted systems: {selectedSystems.map((system) => SYSTEM_OPTIONS.find((item) => item.id === system)?.label).filter(Boolean).join(" | ") || "Not set"}</p>
            <p className="mt-1">Overall: {overallDescription || `Minimum ${overallUniversal} universal score`}</p>
            <p className="mt-1">English: IELTS {ieltsOverall || "-"}, TOEFL {toeflTotal || "-"}, PTE {pteTotal || "-"}</p>
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(subjectRowsByType)
                .flatMap(([typeKey, rows]) => rows
                  .filter((row) => row.subjectName.trim())
                  .map((row) => ({ typeKey, row })))
                .map(({ typeKey, row }) => (
                  <li key={`${typeKey}-${row.id}`}>
                    [{qualificationLabel(typeKey as QualificationTypeKey)}] {row.subjectName} ({row.requirementType})
                    {row.minimumGrade ? ` - Minimum grade: ${row.minimumGrade}` : ""}
                    {row.notes ? ` | ${row.notes}` : ""}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {showStudentPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">Preview as Student</h4>
              <button
                type="button"
                onClick={() => setShowStudentPreviewModal(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <input
                value={previewNationality}
                onChange={(event) => setPreviewNationality(event.target.value)}
                placeholder="Student nationality (e.g. Bangladesh)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={previewProgrammeLevel}
                onChange={(event) => setPreviewProgrammeLevel(event.target.value as ProgrammeLevel)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {PROGRAMME_LEVEL_OPTIONS.map((level) => (
                  <option key={`preview-${level}`} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <CountryEntryRequirementsDisplay
              courseId={courseId}
              studentNationality={previewNationality}
              programmeLevel={previewProgrammeLevel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
