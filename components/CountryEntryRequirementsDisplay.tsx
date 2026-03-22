"use client";

import { useEffect, useState } from "react";
import { CountryQualificationType, ProgrammeLevel } from "@prisma/client";
import { COUNTRY_QUALIFICATION_LABELS } from "@/lib/country-qualification";

type Props = {
  courseId: string;
  studentNationality: string;
  programmeLevel: ProgrammeLevel;
};

type ApiPayload = {
  data: {
    source: "country-and-level" | "country-all-level" | "default-and-level" | "default-all-level" | "general";
    countryCode: string;
    programmeLevel: ProgrammeLevel;
    resolvedRequirement: {
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
    } | null;
    generalRequirement: {
      overallDescription: string | null;
      overallMinUniversal: number | null;
      englishReqIelts: number | null;
      englishReqPte: number | null;
      englishReqToefl: number | null;
      subjectRequirements: Array<{
        subjectName: string;
        minimumDescription: string | null;
      }>;
    } | null;
  };
};

export default function CountryEntryRequirementsDisplay({
  courseId,
  studentNationality,
  programmeLevel,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload["data"] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const query = new URLSearchParams({
          studentNationality,
          programmeLevel,
        });
        const res = await fetch(`/api/courses/${courseId}/country-entry-requirements?${query.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json() as ApiPayload | { error: string };
        if (!res.ok || !("data" in json)) {
          throw new Error("error" in json ? json.error : "Failed to load country requirements");
        }
        setPayload(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load country requirements");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [courseId, studentNationality, programmeLevel]);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading entry requirements...</div>;
  }

  if (error || !payload) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error || "Unable to load requirements"}</div>;
  }

  const requirement = payload.resolvedRequirement;
  const general = payload.generalRequirement;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Entry requirements for {studentNationality || payload.countryCode || "your country"}</h3>

      <section>
        <h4 className="text-sm font-semibold text-slate-800">1. Academic entry requirements</h4>
        {requirement ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Qualification: {COUNTRY_QUALIFICATION_LABELS[requirement.qualificationType]}</li>
            <li>{requirement.minGradeDescription}</li>
            {requirement.minUniversalScore != null && <li>Minimum universal score: {requirement.minUniversalScore}</li>}
            {requirement.requiredSubjects.length > 0 && (
              <li>
                Required subjects:
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {requirement.requiredSubjects.map((subject) => (
                    <li key={subject.id}>
                      {subject.subjectName} — min {subject.minimumGrade} ({subject.isMandatory ? "Mandatory" : "Preferred"})
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {requirement.minimumSubjectsRequired != null && <li>Minimum subject count: {requirement.minimumSubjectsRequired}</li>}
            {requirement.notes && <li>Notes: {requirement.notes}</li>}
            {requirement.alternativePathwayAccepted && requirement.alternativePathwayDetails && (
              <li>Alternative pathway: {requirement.alternativePathwayDetails}</li>
            )}
          </ul>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{general?.overallDescription || "Refer to general course entry requirements."}</li>
            {general?.overallMinUniversal != null && <li>Minimum universal score: {general.overallMinUniversal}</li>}
            {(general?.subjectRequirements || []).map((item, index) => (
              <li key={`${item.subjectName}-${index}`}>{item.subjectName}{item.minimumDescription ? ` - ${item.minimumDescription}` : ""}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-slate-800">2. Language entry requirements</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            {requirement?.ukviIeltsRequired
              ? `UKVI IELTS required${general?.englishReqIelts != null ? ` (minimum ${general.englishReqIelts})` : ""}`
              : `IELTS${general?.englishReqIelts != null ? ` minimum ${general.englishReqIelts}` : " as specified by course"}`}
          </li>
          {general?.englishReqPte != null && <li>PTE minimum total: {general.englishReqPte}</li>}
          {general?.englishReqToefl != null && <li>TOEFL minimum total: {general.englishReqToefl}</li>}
          {requirement?.noEnglishWaiver && <li>No English waiver available.</li>}
          {requirement?.englishSubjectOverride && requirement.englishOverrideSubjects && (
            <li>
              Higher English for {requirement.englishOverrideSubjects}
              {requirement.englishOverrideIELTS ? ` (IELTS ${requirement.englishOverrideIELTS})` : ""}
            </li>
          )}
        </ul>
      </section>

      {requirement?.alternativePathwayAccepted && requirement.alternativePathwayDetails && (
        <section>
          <h4 className="text-sm font-semibold text-slate-800">3. Alternative pathways</h4>
          <p className="mt-2 text-sm text-slate-700">{requirement.alternativePathwayDetails}</p>
        </section>
      )}

      {requirement?.contextualOfferAvailable && requirement.contextualOfferDetails && (
        <section>
          <h4 className="text-sm font-semibold text-slate-800">4. Contextual offers</h4>
          <p className="mt-2 text-sm text-slate-700">{requirement.contextualOfferDetails}</p>
        </section>
      )}

      {requirement?.transferStudentAccepted && requirement.transferStudentDetails && (
        <section>
          <h4 className="text-sm font-semibold text-slate-800">5. Transfer students</h4>
          <p className="mt-2 text-sm text-slate-700">{requirement.transferStudentDetails}</p>
        </section>
      )}
    </div>
  );
}
