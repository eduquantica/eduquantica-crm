"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertTriangle, CheckCircle2, FileText, Info, Loader2, Upload } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import { COUNTRIES } from "@/lib/countries";
import { toApiFilesPath } from "@/lib/file-url";
import {
  BRITISH_COUNCIL,
  CERTIFICATIONS,
  DESTINATIONS,
  EMPTY_REGISTRATION,
  EXPECTED_ENROLMENTS,
  FEE_MODELS,
  LEAD_SOURCES,
  LEGAL_STRUCTURES,
  MAX_SOURCE_COUNTRIES,
  PROGRAM_TYPES,
  REGISTRATION_STEPS,
  SERVICES,
  STAFF_COUNTS,
  STUDENTS_PLACED,
  SUB_AGENTS_MANAGED,
  VISA_APPROVAL_RATES,
  YEARS_OF_EXPERIENCE,
  getMissingFields,
  type MissingField,
  type RegistrationForm,
} from "@/lib/agent-business-registration";

type Option = { value: string; label: string };
type Step = 1 | 2 | 3 | 4;
type Status = "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED";

type LoadedState = {
  approvalStatus: Status;
  rejectionReason: string | null;
  openInfoRequest: { adminMessage: string; createdAt: string } | null;
  submittedAt: string | null;
  editable: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A] disabled:bg-slate-50 disabled:text-slate-500";

function Label({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-sm font-medium text-slate-800">
        {children}
        {required && <span className="text-red-500"> *</span>}
      </p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function FieldError({ show, message }: { show: boolean; message?: string }) {
  if (!show) return null;
  return <p className="mt-1 text-xs text-red-600">{message || "This answer is required."}</p>;
}

function RadioGroup({ name, options, value, onChange }: {
  name: string; options: Option[]; value: string | null; onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const YES_NO: Option[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

function YesNo({ name, value, onChange }: { name: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <RadioGroup
      name={name}
      options={YES_NO}
      value={value === null ? null : value ? "yes" : "no"}
      onChange={(next) => onChange(next === "yes")}
    />
  );
}

function CheckboxGroup({ options, values, onChange, locked = [] }: {
  options: Option[]; values: string[]; onChange: (values: string[]) => void; locked?: string[];
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isLocked = locked.includes(option.value);
        return (
          <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              disabled={isLocked}
              onChange={(event) =>
                onChange(event.target.checked ? [...values, option.value] : values.filter((v) => v !== option.value))
              }
            />
            {option.label}
            {isLocked && <span className="text-xs font-medium text-[#1B2A4A]">(required)</span>}
          </label>
        );
      })}
    </div>
  );
}

function FileField({ label, value, onChange, required, hint, invalid }: {
  label: string; value: string | null; onChange: (url: string | null) => void; required?: boolean; hint?: string; invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("files", file);
      body.append("preserveOriginal", "true");
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.urls?.[0]) throw new Error(json.error || "Upload failed");
      onChange(json.urls[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <Label required={required} hint={hint}>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {value ? "Replace file" : "Choose file"}
        </button>
        {value ? (
          <a href={toApiFilesPath(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
            <FileText className="h-4 w-4" /> Uploaded — view file
          </a>
        ) : (
          <span className="text-sm text-slate-500">No file chosen</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">PDF, image or Word document, up to 10 MB.</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <FieldError show={Boolean(invalid)} message="Please upload this document." />
    </div>
  );
}

export default function BusinessRegistrationClient() {
  const router = useRouter();
  const [form, setForm] = useState<RegistrationForm>(EMPTY_REGISTRATION);
  const [state, setState] = useState<LoadedState | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [showErrorsFor, setShowErrorsFor] = useState<Step[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/agent/business-registration");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(json.error || "Could not load your registration.");
        return;
      }
      setForm(json.data.registration);
      setStep(Math.min(Math.max(json.data.registration.currentStep || 1, 1), 4) as Step);
      setState(json.data);
    })();
  }, []);

  const missing = useMemo(() => getMissingFields(form), [form]);
  const readOnly = state ? !state.editable : true;

  function set<K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function invalid(field: keyof RegistrationForm) {
    return showErrorsFor.includes(step) && missing.some((item) => item.field === field && item.step === step);
  }

  async function save(nextStep: Step) {
    const res = await fetch("/api/agent/business-registration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, currentStep: nextStep }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not save your answers.");
  }

  async function goTo(nextStep: Step, requireCurrent: boolean) {
    setMessage(null);
    if (requireCurrent && missing.some((item) => item.step === step)) {
      setShowErrorsFor((prev) => [...prev, step]);
      setMessage({ tone: "error", text: "Please answer the required questions on this step." });
      return;
    }
    if (readOnly) {
      setStep(nextStep);
      window.scrollTo({ top: 0 });
      return;
    }
    setSaving(true);
    try {
      await save(nextStep);
      setStep(nextStep);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save your answers." });
    } finally {
      setSaving(false);
    }
  }

  async function saveForLater() {
    setSaving(true);
    setMessage(null);
    try {
      await save(step);
      setMessage({ tone: "success", text: "Saved. You can come back and finish at any time." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save your answers." });
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setMessage(null);
    if (missing.length > 0) {
      setShowErrorsFor([1, 2, 3, 4]);
      const first = missing[0];
      setStep(first.step);
      setMessage({ tone: "error", text: `Some required answers are missing, starting with: ${first.message}.` });
      return;
    }
    setSaving(true);
    try {
      await save(4);
      const res = await fetch("/api/agent/business-registration", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstMissing = (json.missing as MissingField[] | undefined)?.[0];
        if (firstMissing) setStep(firstMissing.step);
        throw new Error(json.error || "Could not submit your registration.");
      }
      router.push("/agent/pending?submitted=1");
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not submit your registration." });
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <p className="text-sm text-red-600">{loadError}</p>
      </Shell>
    );
  }
  if (!state) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading your registration…</p>
      </Shell>
    );
  }

  const sourceCountry = (index: number) => form.sourceCountries[index] ?? "";
  const setSourceCountry = (index: number, value: string) => {
    const next = [...form.sourceCountries];
    next[index] = value;
    set("sourceCountries", next.filter(Boolean).slice(0, MAX_SOURCE_COUNTRIES));
  };

  return (
    <Shell>
      <StatusBanner state={state} />

      <ol className="mb-6 grid grid-cols-4 gap-2">
        {REGISTRATION_STEPS.map((item) => {
          const done = !missing.some((m) => m.step === item.step);
          const active = item.step === step;
          return (
            <li key={item.step}>
              <button
                type="button"
                onClick={() => void goTo(item.step as Step, false)}
                className={`w-full rounded-lg border px-2 py-2 text-left text-xs transition ${active ? "border-[#1B2A4A] bg-[#1B2A4A] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                <span className="flex items-center gap-1 font-semibold">
                  Step {item.step}
                  {done && <CheckCircle2 className={`h-3.5 w-3.5 ${active ? "text-white" : "text-emerald-600"}`} />}
                </span>
                <span className="mt-0.5 hidden sm:block">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <h2 className="mb-5 text-lg font-semibold text-slate-900">{REGISTRATION_STEPS[step - 1].title}</h2>

      <fieldset disabled={readOnly || saving} className="space-y-6">
        {step === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required hint="As per your business documentation">Legal business name</Label>
                <input className={inputClass} value={form.legalBusinessName ?? ""} onChange={(e) => set("legalBusinessName", e.target.value)} />
                <FieldError show={invalid("legalBusinessName")} />
              </div>
              <div>
                <Label required hint="As per your business documentation">Business registration number</Label>
                <input className={inputClass} value={form.businessRegistrationNumber ?? ""} onChange={(e) => set("businessRegistrationNumber", e.target.value)} />
                <FieldError show={invalid("businessRegistrationNumber")} />
              </div>
              <div>
                <Label required hint="The government body or authority that issued the registration">Business certificate issuing authority</Label>
                <input className={inputClass} value={form.certificateIssuingAuthority ?? ""} onChange={(e) => set("certificateIssuingAuthority", e.target.value)} />
                <FieldError show={invalid("certificateIssuingAuthority")} />
              </div>
              <div>
                <Label required hint="Full 4-digit year, e.g. 2018">In which year was your business founded?</Label>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.yearFounded ?? ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    set("yearFounded", digits ? Number(digits) : null);
                  }}
                />
                <FieldError show={invalid("yearFounded")} message="Enter a valid 4-digit year." />
              </div>
            </div>

            <div>
              <Label required>Agency legal structure</Label>
              <RadioGroup name="legalStructure" options={LEGAL_STRUCTURES} value={form.legalStructure} onChange={(v) => set("legalStructure", v)} />
              {form.legalStructure === "OTHER" && (
                <input className={`${inputClass} mt-2`} placeholder="Describe your legal structure" value={form.legalStructureOther ?? ""} onChange={(e) => set("legalStructureOther", e.target.value)} />
              )}
              <FieldError show={invalid("legalStructure") || invalid("legalStructureOther")} />
            </div>

            <FileField
              label="Upload your business certificate"
              required
              value={form.businessCertificateUrl}
              onChange={(url) => set("businessCertificateUrl", url)}
              invalid={invalid("businessCertificateUrl")}
            />

            <div>
              <Label required hint="British Council certification is mandatory for all EduQuantica partners.">Government/destination certifications</Label>
              <CheckboxGroup
                options={CERTIFICATIONS}
                values={form.certifications}
                locked={[BRITISH_COUNCIL]}
                onChange={(values) => set("certifications", values.includes(BRITISH_COUNCIL) ? values : [BRITISH_COUNCIL, ...values])}
              />
              {form.certifications.includes("OTHER") && (
                <input className={`${inputClass} mt-2`} placeholder="Name your other certification" value={form.certificationsOther ?? ""} onChange={(e) => set("certificationsOther", e.target.value)} />
              )}
              <FieldError show={invalid("certificationsOther")} />
            </div>

            <div className="rounded-xl border border-[#1B2A4A]/20 bg-[#1B2A4A]/5 p-4 space-y-4">
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1B2A4A]" />
                Only British Council certified agents can be approved. Upload the British Council agent training certificate for your agency.
              </p>
              <FileField
                label="British Council agent certificate"
                required
                value={form.britishCouncilCertificateUrl}
                onChange={(url) => set("britishCouncilCertificateUrl", url)}
                invalid={invalid("britishCouncilCertificateUrl")}
              />
              <div>
                <Label hint="If shown on your certificate">Certificate or agent ID number</Label>
                <input className={inputClass} value={form.britishCouncilCertificateNumber ?? ""} onChange={(e) => set("britishCouncilCertificateNumber", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required hint="As per official business documentation">Owner&apos;s first name</Label>
                <input className={inputClass} value={form.ownerFirstName ?? ""} onChange={(e) => set("ownerFirstName", e.target.value)} />
                <FieldError show={invalid("ownerFirstName")} />
              </div>
              <div>
                <Label required hint="As per official business documentation">Owner&apos;s last name</Label>
                <input className={inputClass} value={form.ownerLastName ?? ""} onChange={(e) => set("ownerLastName", e.target.value)} />
                <FieldError show={invalid("ownerLastName")} />
              </div>
            </div>
            <div>
              <Label required hint='Write "None" if there are no co-owners'>Please list all co-owners/partners</Label>
              <textarea rows={2} className={inputClass} value={form.coOwners ?? ""} onChange={(e) => set("coOwners", e.target.value)} />
              <FieldError show={invalid("coOwners")} />
            </div>
            <FileField
              label="Owner's government-issued personal ID"
              required
              hint="Passport or national ID card"
              value={form.ownerIdDocumentUrl}
              onChange={(url) => set("ownerIdDocumentUrl", url)}
              invalid={invalid("ownerIdDocumentUrl")}
            />

            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-900">Business address</p>
              <div>
                <Label required hint="As per your business registration certificate">Street</Label>
                <input className={inputClass} value={form.addressStreet ?? ""} onChange={(e) => set("addressStreet", e.target.value)} />
                <FieldError show={invalid("addressStreet")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>City</Label>
                  <input className={inputClass} value={form.addressCity ?? ""} onChange={(e) => set("addressCity", e.target.value)} />
                  <FieldError show={invalid("addressCity")} />
                </div>
                <div>
                  <Label required>Province/State</Label>
                  <input className={inputClass} value={form.addressState ?? ""} onChange={(e) => set("addressState", e.target.value)} />
                  <FieldError show={invalid("addressState")} />
                </div>
                <div>
                  <Label required>Country</Label>
                  <select className={inputClass} value={form.addressCountry ?? ""} onChange={(e) => set("addressCountry", e.target.value || null)}>
                    <option value="">Select country</option>
                    {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                  </select>
                  <FieldError show={invalid("addressCountry")} />
                </div>
                <div>
                  <Label required>Postal code</Label>
                  <input className={inputClass} value={form.addressPostalCode ?? ""} onChange={(e) => set("addressPostalCode", e.target.value)} />
                  <FieldError show={invalid("addressPostalCode")} />
                </div>
              </div>
            </div>

            <div>
              <Label required>Do you operate physical offices?</Label>
              <YesNo name="hasPhysicalOffice" value={form.hasPhysicalOffice} onChange={(v) => set("hasPhysicalOffice", v)} />
              <FieldError show={invalid("hasPhysicalOffice")} />
            </div>
            {form.hasPhysicalOffice && (
              <>
                <div>
                  <Label required>Is your head office address the same as the business address above?</Label>
                  <YesNo name="headOfficeSameAsBusiness" value={form.headOfficeSameAsBusiness} onChange={(v) => set("headOfficeSameAsBusiness", v)} />
                  {form.headOfficeSameAsBusiness === false && (
                    <textarea rows={2} className={`${inputClass} mt-2`} placeholder="Head office address" value={form.headOfficeAddress ?? ""} onChange={(e) => set("headOfficeAddress", e.target.value)} />
                  )}
                  <FieldError show={invalid("headOfficeSameAsBusiness") || invalid("headOfficeAddress")} />
                </div>
                <div>
                  <Label required>Do you have additional offices?</Label>
                  <YesNo name="hasAdditionalOffices" value={form.hasAdditionalOffices} onChange={(v) => set("hasAdditionalOffices", v)} />
                  {form.hasAdditionalOffices && (
                    <textarea rows={2} className={`${inputClass} mt-2`} placeholder="List your other office locations" value={form.additionalOfficesDetails ?? ""} onChange={(e) => set("additionalOfficesDetails", e.target.value)} />
                  )}
                  <FieldError show={invalid("hasAdditionalOffices") || invalid("additionalOfficesDetails")} />
                </div>
              </>
            )}

            <div>
              <Label required>How many staff/counsellors currently work in your agency?</Label>
              <RadioGroup name="staffCount" options={STAFF_COUNTS} value={form.staffCount} onChange={(v) => set("staffCount", v)} />
              <FieldError show={invalid("staffCount")} />
            </div>
            <div>
              <Label>Are you part of a franchise or parent network?</Label>
              <YesNo name="isFranchise" value={form.isFranchise} onChange={(v) => set("isFranchise", v)} />
              {form.isFranchise && (
                <input className={`${inputClass} mt-2`} placeholder="Franchise or parent network name" value={form.franchiseName ?? ""} onChange={(e) => set("franchiseName", e.target.value)} />
              )}
              <FieldError show={invalid("franchiseName")} />
            </div>
            <div>
              <Label required>What services beyond school placement does your agency currently offer?</Label>
              <CheckboxGroup options={SERVICES} values={form.servicesOffered} onChange={(v) => set("servicesOffered", v)} />
              {form.servicesOffered.includes("OTHER") && (
                <input className={`${inputClass} mt-2`} placeholder="Describe your other services" value={form.servicesOther ?? ""} onChange={(e) => set("servicesOther", e.target.value)} />
              )}
              <FieldError show={invalid("servicesOffered") || invalid("servicesOther")} />
            </div>
            <div>
              <Label required>Do you charge students service fees, or operate on a commission-only model?</Label>
              <RadioGroup name="feeModel" options={FEE_MODELS} value={form.feeModel} onChange={(v) => set("feeModel", v)} />
              <FieldError show={invalid("feeModel")} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <Label required hint={`Select up to ${MAX_SOURCE_COUNTRIES} countries`}>From which countries or regions do you recruit students?</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: MAX_SOURCE_COUNTRIES }, (_, index) => (
                  <select
                    key={index}
                    className={inputClass}
                    value={sourceCountry(index)}
                    disabled={index > form.sourceCountries.length}
                    onChange={(e) => setSourceCountry(index, e.target.value)}
                  >
                    <option value="">{index === 0 ? "Select country" : "Optional"}</option>
                    {COUNTRIES.filter((c) => c === sourceCountry(index) || !form.sourceCountries.includes(c)).map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                ))}
              </div>
              <FieldError show={invalid("sourceCountries")} />
            </div>
            <div>
              <Label required>Which countries do you primarily send students to?</Label>
              <CheckboxGroup options={DESTINATIONS} values={form.destinationCountries} onChange={(v) => set("destinationCountries", v)} />
              <FieldError show={invalid("destinationCountries")} />
            </div>
            <div>
              <Label required>What types of programs are your students interested in?</Label>
              <CheckboxGroup options={PROGRAM_TYPES} values={form.programTypes} onChange={(v) => set("programTypes", v)} />
              {form.programTypes.includes("OTHER") && (
                <input className={`${inputClass} mt-2`} placeholder="Describe the other program types" value={form.programTypesOther ?? ""} onChange={(e) => set("programTypesOther", e.target.value)} />
              )}
              <FieldError show={invalid("programTypes") || invalid("programTypesOther")} />
            </div>
            <div>
              <Label>How do you typically acquire new student leads?</Label>
              <CheckboxGroup options={LEAD_SOURCES} values={form.leadSources} onChange={(v) => set("leadSources", v)} />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <Label required>Do you have experience in student recruitment?</Label>
              <YesNo name="hasRecruitmentExperience" value={form.hasRecruitmentExperience} onChange={(v) => set("hasRecruitmentExperience", v)} />
              <FieldError show={invalid("hasRecruitmentExperience")} />
            </div>
            {form.hasRecruitmentExperience && (
              <>
                <div>
                  <Label required>How many years of experience do you have in the student recruitment industry?</Label>
                  <RadioGroup name="yearsOfExperience" options={YEARS_OF_EXPERIENCE} value={form.yearsOfExperience} onChange={(v) => set("yearsOfExperience", v)} />
                  <FieldError show={invalid("yearsOfExperience")} />
                </div>
                <div>
                  <Label required>How many students have you placed in international institutions in the past 12 months?</Label>
                  <RadioGroup name="studentsPlaced" options={STUDENTS_PLACED} value={form.studentsPlacedLast12Months} onChange={(v) => set("studentsPlacedLast12Months", v)} />
                  <FieldError show={invalid("studentsPlacedLast12Months")} />
                </div>
              </>
            )}
            <div>
              <Label required>How many student enrolments do you expect to submit through EduQuantica in the upcoming academic year?</Label>
              <RadioGroup name="expectedEnrolments" options={EXPECTED_ENROLMENTS} value={form.expectedEnrolments} onChange={(v) => set("expectedEnrolments", v)} />
              <FieldError show={invalid("expectedEnrolments")} />
            </div>
            <div>
              <Label>What percentage of your students typically receive a visa approval?</Label>
              <select className={inputClass} value={form.visaApprovalRate ?? ""} onChange={(e) => set("visaApprovalRate", e.target.value || null)}>
                <option value="">Select</option>
                {VISA_APPROVAL_RATES.map((rate) => <option key={rate.value} value={rate.value}>{rate.label}</option>)}
              </select>
            </div>
            <div>
              <Label required>Do you currently work with other aggregators or sub-agents?</Label>
              <YesNo name="worksWithAggregators" value={form.worksWithAggregators} onChange={(v) => set("worksWithAggregators", v)} />
              {form.worksWithAggregators && (
                <textarea rows={2} className={`${inputClass} mt-2`} placeholder="Please list them" value={form.aggregatorsList ?? ""} onChange={(e) => set("aggregatorsList", e.target.value)} />
              )}
              <FieldError show={invalid("worksWithAggregators") || invalid("aggregatorsList")} />
            </div>
            <div>
              <Label required>How many sub-agents do you currently manage?</Label>
              <RadioGroup name="subAgentsManaged" options={SUB_AGENTS_MANAGED} value={form.subAgentsManaged} onChange={(v) => set("subAgentsManaged", v)} />
              <FieldError show={invalid("subAgentsManaged")} />
            </div>
            {form.subAgentsManaged && form.subAgentsManaged !== "0" && (
              <div>
                <Label>How do you onboard, monitor, and train them?</Label>
                <textarea rows={3} className={inputClass} value={form.subAgentManagementProcess ?? ""} onChange={(e) => set("subAgentManagementProcess", e.target.value)} />
              </div>
            )}
            <div>
              <Label>Do you have a website or social media presence?</Label>
              <YesNo name="hasOnlinePresence" value={form.hasOnlinePresence} onChange={(v) => set("hasOnlinePresence", v)} />
            </div>
            {form.hasOnlinePresence && (
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["websiteUrl", "Website link"],
                  ["linkedinUrl", "LinkedIn"],
                  ["facebookUrl", "Facebook page"],
                  ["instagramUrl", "Instagram profile"],
                  ["tiktokUrl", "TikTok profile"],
                ] as const).map(([key, label]) => (
                  <div key={key} className={key === "websiteUrl" ? "sm:col-span-2" : undefined}>
                    <Label>{label}</Label>
                    <input className={inputClass} placeholder="https://" value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="sm:col-span-2"><FieldError show={invalid("websiteUrl")} message="Add at least one link." /></div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                I have read and agree to the EduQuantica Terms and Conditions and Sub-Agent Agreement. The information and
                documents I have provided are true and complete. I understand that a false statement or supporting document
                may disqualify me from becoming an EduQuantica recruitment partner.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={form.consentAccepted} onChange={(e) => set("consentAccepted", e.target.checked)} />
                I consent <span className="text-red-500">*</span>
              </label>
              <FieldError show={invalid("consentAccepted")} message="Please tick to confirm." />
            </div>
          </>
        )}
      </fieldset>

      {message && (
        <p className={`mt-6 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
        <button
          type="button"
          disabled={step === 1 || saving}
          onClick={() => void goTo((step - 1) as Step, false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        <div className="flex flex-wrap gap-3">
          {!readOnly && (
            <button type="button" disabled={saving} onClick={() => void saveForLater()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              Save and finish later
            </button>
          )}
          {step < 4 ? (
            <button type="button" disabled={saving} onClick={() => void goTo((step + 1) as Step, !readOnly)} className="eq-primary-btn rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? "Saving…" : "Next"}
            </button>
          ) : (
            !readOnly && (
              <button type="button" disabled={saving} onClick={() => void submit()} className="eq-primary-btn rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60">
                {saving ? "Submitting…" : state.approvalStatus === "INFO_REQUESTED" ? "Resubmit for review" : "Submit for review"}
              </button>
            )
          )}
        </div>
      </div>
    </Shell>
  );
}

function StatusBanner({ state }: { state: LoadedState }) {
  if (state.approvalStatus === "INFO_REQUESTED") {
    return (
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">EduQuantica has asked for more information</p>
        {state.openInfoRequest && <p className="mt-1 whitespace-pre-wrap">{state.openInfoRequest.adminMessage}</p>}
        <p className="mt-2">Update your answers or documents below, then resubmit on step 4.</p>
      </div>
    );
  }
  if (state.approvalStatus === "APPROVED" && !state.submittedAt) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <span className="font-semibold">Please complete your business registration.</span> EduQuantica now verifies every
        partner agency, including a British Council agent certificate. Your portal access stays active while you do this.
      </div>
    );
  }
  if (state.approvalStatus === "APPROVED") {
    return (
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Your account is approved. This is a read-only copy of your business registration.{" "}
        <Link href="/agent/dashboard" className="font-semibold underline">Go to your dashboard</Link>
      </div>
    );
  }
  if (state.approvalStatus === "REJECTED") {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">Your application was not approved.</p>
        {state.rejectionReason && <p className="mt-1">{state.rejectionReason}</p>}
      </div>
    );
  }
  if (state.submittedAt) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Submitted on {new Date(state.submittedAt).toLocaleDateString("en-GB")} and under review. We usually reply within 2-3 business days.
      </div>
    );
  }
  return (
    <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">Activate your account.</span> Complete these four steps so we can verify your agency.
        Your answers are saved as you go. A British Council agent certificate is required.
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FC] px-4 py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4 bg-[#1B2A4A] px-8 py-8">
          <div>
            <BrandLogo variant="white" width={210} />
            <h1 className="mt-4 text-2xl font-bold text-white">Business Registration</h1>
            <p className="mt-1 text-sm text-white/80">Verify your agency to activate your EduQuantica partner account.</p>
          </div>
          <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })} className="text-sm text-white/80 hover:text-white">
            Sign out
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
