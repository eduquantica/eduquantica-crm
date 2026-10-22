import { format } from "date-fns";
import type { SubAgentBusinessRegistration } from "@prisma/client";
import { AlertTriangle, BadgeCheck, Download, ExternalLink, FileText } from "lucide-react";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";
import {
  CERTIFICATIONS,
  DESTINATIONS,
  EXPECTED_ENROLMENTS,
  FEE_MODELS,
  LEAD_SOURCES,
  LEGAL_STRUCTURES,
  PROGRAM_TYPES,
  REGISTRATION_STEPS,
  SERVICES,
  STAFF_COUNTS,
  STUDENTS_PLACED,
  SUB_AGENTS_MANAGED,
  YEARS_OF_EXPERIENCE,
  getMissingFields,
  optionLabel,
  optionLabels,
  registrationToForm,
} from "@/lib/agent-business-registration";

const yesNo = (value: boolean | null) => (value === null ? null : value ? "Yes" : "No");
const withOther = (labels: string[], other: string | null) =>
  labels.map((label) => (label === "Other" && other ? `Other: ${other}` : label)).join(", ") || null;

function Answer({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{value || "—"}</div>
    </div>
  );
}

function Document({ label, url, highlight }: { label: string; url: string | null; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
      {highlight ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4 text-slate-400" />}
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {url ? (
        <div className="ml-auto flex gap-2">
          <a href={toApiFilesPath(url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
            <ExternalLink className="h-3.5 w-3.5" /> Preview
          </a>
          <a href={toApiFilesDownloadPath(url)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      ) : (
        <span className="ml-auto text-xs font-medium text-red-600">Not uploaded</span>
      )}
    </div>
  );
}

function Section({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="space-y-4 px-5 py-5">
      <h3 className="text-sm font-semibold text-slate-900">
        {step}. {REGISTRATION_STEPS[step - 1].title}
      </h3>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function BusinessRegistrationReview({ registration, approved }: { registration: SubAgentBusinessRegistration | null; approved: boolean }) {
  const form = registrationToForm(registration);
  const missing = getMissingFields(form);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Business Registration</h2>
        {registration?.submittedAt ? (
          <span className="text-xs text-slate-500">Submitted {format(new Date(registration.submittedAt), "dd MMM yyyy, HH:mm")}</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            {registration ? `In progress — step ${registration.currentStep} of 4` : "Not started"}
          </span>
        )}
      </div>

      {!registration?.submittedAt && (
        <div className="flex items-start gap-2 border-b border-slate-100 px-5 py-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {approved
              ? "This partner was approved before business registration was required and hasn't submitted one yet."
              : "The agent has not submitted their business registration yet, so this application can't be approved."}
            {missing.length > 0 && registration && ` Still missing: ${missing.slice(0, 6).map((m) => m.message).join(", ")}${missing.length > 6 ? ", …" : ""}.`}
          </p>
        </div>
      )}

      {registration && (
        <div className="divide-y divide-slate-100">
          <div className="space-y-2 px-5 py-5">
            <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
            <Document label="British Council agent certificate (mandatory)" url={form.britishCouncilCertificateUrl} highlight={Boolean(form.britishCouncilCertificateUrl)} />
            <Document label="Business certificate" url={form.businessCertificateUrl} />
            <Document label="Owner's government-issued ID" url={form.ownerIdDocumentUrl} />
          </div>

          <Section step={1}>
            <Answer label="Legal business name" value={form.legalBusinessName} />
            <Answer label="Registration number" value={form.businessRegistrationNumber} />
            <Answer label="Issuing authority" value={form.certificateIssuingAuthority} />
            <Answer label="Year founded" value={form.yearFounded} />
            <Answer label="Legal structure" value={form.legalStructure === "OTHER" ? `Other: ${form.legalStructureOther ?? ""}` : optionLabel(LEGAL_STRUCTURES, form.legalStructure)} />
            <Answer label="Certifications" value={withOther(optionLabels(CERTIFICATIONS, form.certifications), form.certificationsOther)} />
            <Answer label="British Council certificate / agent ID number" value={form.britishCouncilCertificateNumber} />
          </Section>

          <Section step={2}>
            <Answer label="Owner" value={[form.ownerFirstName, form.ownerLastName].filter(Boolean).join(" ")} />
            <Answer label="Co-owners / partners" value={form.coOwners} />
            <Answer
              label="Business address"
              wide
              value={[form.addressStreet, form.addressCity, form.addressState, form.addressPostalCode, form.addressCountry].filter(Boolean).join(", ")}
            />
            <Answer label="Physical offices" value={yesNo(form.hasPhysicalOffice)} />
            {form.hasPhysicalOffice && (
              <>
                <Answer label="Head office" value={form.headOfficeSameAsBusiness ? "Same as business address" : form.headOfficeAddress} />
                <Answer label="Additional offices" value={form.hasAdditionalOffices ? form.additionalOfficesDetails : yesNo(form.hasAdditionalOffices)} />
              </>
            )}
            <Answer label="Staff / counsellors" value={optionLabel(STAFF_COUNTS, form.staffCount)} />
            <Answer label="Franchise or parent network" value={form.isFranchise ? form.franchiseName || "Yes" : yesNo(form.isFranchise)} />
            <Answer label="Fee model" value={optionLabel(FEE_MODELS, form.feeModel)} />
            <Answer label="Services offered" wide value={withOther(optionLabels(SERVICES, form.servicesOffered), form.servicesOther)} />
          </Section>

          <Section step={3}>
            <Answer label="Recruits students from" value={form.sourceCountries.join(", ")} />
            <Answer label="Sends students to" value={optionLabels(DESTINATIONS, form.destinationCountries).join(", ")} />
            <Answer label="Program types" value={withOther(optionLabels(PROGRAM_TYPES, form.programTypes), form.programTypesOther)} />
            <Answer label="Lead sources" value={optionLabels(LEAD_SOURCES, form.leadSources).join(", ")} />
          </Section>

          <Section step={4}>
            <Answer label="Recruitment experience" value={yesNo(form.hasRecruitmentExperience)} />
            <Answer label="Years of experience" value={optionLabel(YEARS_OF_EXPERIENCE, form.yearsOfExperience)} />
            <Answer label="Students placed (last 12 months)" value={optionLabel(STUDENTS_PLACED, form.studentsPlacedLast12Months)} />
            <Answer label="Expected enrolments (next year)" value={optionLabel(EXPECTED_ENROLMENTS, form.expectedEnrolments)} />
            <Answer label="Visa approval rate" value={form.visaApprovalRate} />
            <Answer label="Works with other aggregators" value={form.worksWithAggregators ? form.aggregatorsList || "Yes" : yesNo(form.worksWithAggregators)} />
            <Answer label="Sub-agents managed" value={optionLabel(SUB_AGENTS_MANAGED, form.subAgentsManaged)} />
            <Answer label="How they manage sub-agents" value={form.subAgentManagementProcess} />
            <Answer
              label="Online presence"
              wide
              value={
                [form.websiteUrl, form.linkedinUrl, form.facebookUrl, form.instagramUrl, form.tiktokUrl].filter(Boolean).length > 0 ? (
                  <ul className="space-y-0.5">
                    {[form.websiteUrl, form.linkedinUrl, form.facebookUrl, form.instagramUrl, form.tiktokUrl].filter(Boolean).map((link) => (
                      <li key={link}>
                        <a href={/^https?:\/\//.test(link!) ? link! : `https://${link}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{link}</a>
                      </li>
                    ))}
                  </ul>
                ) : yesNo(form.hasOnlinePresence)
              }
            />
            <Answer label="Consent" value={form.consentAccepted ? `Accepted${registration.consentAt ? ` on ${format(new Date(registration.consentAt), "dd MMM yyyy")}` : ""}` : "Not given"} />
          </Section>
        </div>
      )}
    </div>
  );
}
