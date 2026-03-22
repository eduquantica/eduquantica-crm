"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";
import TestScoresManager from "@/components/student/TestScoresManager";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import { toApiFilesDownloadPath } from "@/lib/file-url";
import { COUNTRIES, DESTINATION_COUNTRIES, DIAL_CODES } from "@/lib/countries";

type ProfileResponse = {
  data: {
    studentId: string;
    personal: {
      firstName: string;
      lastName: string;
      email: string;
      dialCode: string;
      phone: string;
      dateOfBirth: string;
      gender: string;
      nationality: string;
      countryOfResidence: string;
      profilePhotoUrl: string;
    };
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      emergencyName: string;
      emergencyRelationship: string;
      emergencyPhone: string;
      emergencyEmail: string;
    };
    passport: {
      passportNumber: string;
      countryOfIssue: string;
      dateOfIssue: string;
      expiryDate: string;
      ocrStatus: string;
      lastOcrName: string;
      lastOcrNumber: string;
      lastOcrExpiry: string;
      lastDocumentId: string;
      passportFileUrl: string;
      passportFileName: string;
      passportUploadedAt: string;
    };
    tests: {
      englishTests: Array<{
        id: string;
        testType: string;
        dateTaken: string;
        isUKVI: boolean;
        overallScore: string;
        listening: string;
        reading: string;
        writing: string;
        speaking: string;
        certificateUrl: string;
        certificateFileName: string;
        ocrConfirmed: boolean;
      }>;
      otherTests: Array<{
        id: string;
        testType: string;
        isUKVI: boolean;
        score: string;
        dateTaken: string;
        certificateUrl: string;
        certificateFileName: string;
        ocrConfirmed: boolean;
      }>;
    };
    work: {
      hasWorkExperience: boolean | null;
    };
    immigration: {
      hasVisaRefusal: boolean;
      refusals: Array<{
        id: string;
        country: string;
        visaType: string;
        refusalMonth: string;
        refusalYear: string;
        reason: string;
        resolved: boolean;
        resolutionDetails: string;
      }>;
    };
    preferences: {
      preferredDestinations: string[];
      preferredStudyLevels: string[];
      preferredFields: string[];
      preferredIntake: string;
      tuitionBudget: string;
      tuitionBudgetCurrency: string;
      preferredCurrencyDisplay: string;
      communicationLanguage: string;
      emailNotifications: boolean;
      smsNotifications: boolean;
      financePortalNotifications: boolean;
      financeEmailNotifications: boolean;
      messagePortalNotifications: boolean;
      messageEmailNotifications: boolean;
    };
    completion?: {
      percentage: number;
      firstIncompleteHref: string;
    };
  };
};

type TabKey = "personal" | "address" | "passport" | "academic" | "work" | "tests" | "immigration" | "preferences";

type WorkExperienceEntry = {
  id?: string;
  employerName: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrentlyWorking: boolean;
  responsibilities: string;
  orderIndex?: number;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "personal", label: "Personal Info" },
  { key: "address", label: "Address and Contact" },
  { key: "passport", label: "Passport and ID" },
  { key: "academic", label: "Academic Profile" },
  { key: "tests", label: "Test Scores" },
  { key: "work", label: "Work Experience" },
  { key: "immigration", label: "Immigration History" },
  { key: "preferences", label: "Preferences" },
];
const TAB_KEYS: TabKey[] = TABS.map((tab) => tab.key);

const GENDERS = ["", "Male", "Female", "Non-binary", "Prefer not to say"];
const PREF_LEVELS = ["Foundation", "Undergraduate", "Postgraduate", "PhD"];
const PREF_FIELDS = [
  "Business",
  "Computer Science",
  "Engineering",
  "Law",
  "Medicine",
  "Public Health",
  "Architecture",
  "Psychology",
  "Data Science",
  "Finance",
  "Design",
  "Education",
  "Hospitality",
  "Media",
  "Social Sciences",
];
const CURRENCIES = ["GBP", "USD", "CAD", "AUD", "EUR", "BDT", "INR", "NGN", "PKR", "NPR", "GHS"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyWorkEntry(): WorkExperienceEntry {
  return {
    employerName: "",
    jobTitle: "",
    location: "",
    startDate: "",
    endDate: "",
    isCurrentlyWorking: false,
    responsibilities: "",
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm backdrop-blur-sm transition focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20 ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm backdrop-blur-sm transition focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20 ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm backdrop-blur-sm transition focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#F5A623] dark:focus:ring-[#F5A623]/20 ${props.className || ""}`}
    />
  );
}

export default function StudentProfilePage() {
  const [studentId, setStudentId] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passportUploading, setPassportUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passportPreviewOpen, setPassportPreviewOpen] = useState(false);

  const [personal, setPersonal] = useState<ProfileResponse["data"]["personal"]>({
    firstName: "",
    lastName: "",
    email: "",
    dialCode: "+44",
    phone: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    countryOfResidence: "",
    profilePhotoUrl: "",
  });
  const [address, setAddress] = useState<ProfileResponse["data"]["address"]>({
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    emergencyEmail: "",
  });
  const [passport, setPassport] = useState<ProfileResponse["data"]["passport"]>({
    passportNumber: "",
    countryOfIssue: "",
    dateOfIssue: "",
    expiryDate: "",
    ocrStatus: "",
    lastOcrName: "",
    lastOcrNumber: "",
    lastOcrExpiry: "",
    lastDocumentId: "",
    passportFileUrl: "",
    passportFileName: "",
    passportUploadedAt: "",
  });
  const [work, setWork] = useState<ProfileResponse["data"]["work"]>({ hasWorkExperience: null });
  const [workExperiences, setWorkExperiences] = useState<WorkExperienceEntry[]>([]);
  const [workSavingIds, setWorkSavingIds] = useState<Record<string, boolean>>({});
  const [immigration, setImmigration] = useState<ProfileResponse["data"]["immigration"]>({ hasVisaRefusal: false, refusals: [] });
  const [preferences, setPreferences] = useState<ProfileResponse["data"]["preferences"]>({
    preferredDestinations: [],
    preferredStudyLevels: [],
    preferredFields: [],
    preferredIntake: "Any",
    tuitionBudget: "",
    tuitionBudgetCurrency: "GBP",
    preferredCurrencyDisplay: "",
    communicationLanguage: "English",
    emailNotifications: true,
    smsNotifications: false,
    financePortalNotifications: true,
    financeEmailNotifications: true,
    messagePortalNotifications: true,
    messageEmailNotifications: true,
  });
  const [fieldSearch, setFieldSearch] = useState("");

  function setTabWithHash(tab: TabKey) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }

  const activeTabIndex = TAB_KEYS.indexOf(activeTab);
  const previousTab = activeTabIndex > 0 ? TAB_KEYS[activeTabIndex - 1] : null;
  const nextTab = activeTabIndex < TAB_KEYS.length - 1 ? TAB_KEYS[activeTabIndex + 1] : null;

  function updateCompletion(percentage?: number) {
    if (typeof percentage === "number") {
      setProfileCompletion(Math.max(0, Math.min(100, percentage)));
    }
  }

  useEffect(() => {
    let mounted = true;
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as TabKey;
      if (TAB_KEYS.includes(hash)) {
        setActiveTab(hash);
      }
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/profile", { cache: "no-store" });
        const json = await res.json() as ProfileResponse | { error: string };
        if (!res.ok || !("data" in json)) {
          throw new Error("error" in json ? json.error : "Failed to load profile");
        }
        if (!mounted) return;
        setStudentId(json.data.studentId);
        setPersonal(json.data.personal);
        setAddress(json.data.address);
        setPassport(json.data.passport);
        setWork(json.data.work);
        setImmigration(json.data.immigration);
        setPreferences(json.data.preferences);
        updateCompletion(json.data.completion?.percentage);

        const workRes = await fetch("/api/student/work-experience", { cache: "no-store" });
        const workJson = await workRes.json() as {
          error?: string;
          data?: { entries: WorkExperienceEntry[]; hasWorkExperience: boolean | null };
        };
        if (workRes.ok && workJson.data) {
          setWork({ hasWorkExperience: workJson.data.hasWorkExperience });
          setWorkExperiences(workJson.data.entries || []);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveTab(tab: Exclude<TabKey, "academic" | "tests">) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data =
        tab === "personal" ? personal :
        tab === "address" ? address :
        tab === "passport" ? passport :
        tab === "work" ? work :
        tab === "immigration" ? immigration :
        preferences;

      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, data }),
      });
      const json = await res.json() as { error?: string; data?: { completion?: { percentage?: number } } };
      if (!res.ok) {
        throw new Error(json.error || "Failed to save");
      }
      updateCompletion(json.data?.completion?.percentage);
      setMessage("Saved successfully.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndNext(tab: Exclude<TabKey, "academic" | "tests">) {
    const ok = await saveTab(tab);
    if (ok && nextTab) {
      setTabWithHash(nextTab);
    }
  }

  function renderTabActions(tab: TabKey, saveable: boolean) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/50 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={() => previousTab && setTabWithHash(previousTab)}
          disabled={!previousTab || saving}
          className="inline-flex h-11 items-center rounded-xl border border-white/50 bg-white/70 px-4 text-sm font-semibold text-slate-700 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900 disabled:opacity-50"
        >
          Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {saveable ? (
            <button
              type="button"
              onClick={() => void saveTab(tab as Exclude<TabKey, "academic" | "tests">)}
              disabled={saving}
              className="inline-flex h-11 items-center rounded-xl border border-[#1E3A5F]/40 bg-white/70 px-4 text-sm font-semibold text-[#1E3A5F] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-[#F5A623]/40 dark:bg-slate-900/60 dark:text-[#F5A623] dark:hover:bg-slate-900 disabled:opacity-60"
            >
              Save
            </button>
          ) : null}
          {nextTab ? (
            <button
              type="button"
              onClick={() => {
                if (!nextTab) return;
                if (!saveable) {
                  setTabWithHash(nextTab);
                  return;
                }
                void handleSaveAndNext(tab as Exclude<TabKey, "academic" | "tests">);
              }}
              disabled={saving}
              className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2a5e8f] px-4 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900 disabled:opacity-60"
            >
              {saveable ? "Save and Next" : "Next"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  async function saveWorkEntry(index: number) {
    const row = workExperiences[index];
    if (!row) return;
    if (!row.employerName.trim() || !row.jobTitle.trim()) {
      setError("Employer name and job title are required.");
      return;
    }

    const localKey = row.id || `tmp-${index}`;
    setWorkSavingIds((prev) => ({ ...prev, [localKey]: true }));
    setError(null);
    setMessage(null);

    try {
      const payload = {
        employerName: row.employerName,
        jobTitle: row.jobTitle,
        location: row.location,
        startDate: row.startDate || null,
        endDate: row.isCurrentlyWorking ? null : (row.endDate || null),
        isCurrentlyWorking: row.isCurrentlyWorking,
        responsibilities: row.responsibilities,
        orderIndex: index,
      };

      const res = await fetch(row.id ? `/api/student/work-experience/${row.id}` : "/api/student/work-experience", {
        method: row.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string; data?: WorkExperienceEntry };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Failed to save work experience");
      }

      setWorkExperiences((prev) => prev.map((entry, i) => (i === index ? json.data! : entry)));
      setWork({ hasWorkExperience: true });
      setMessage("Work experience saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save work experience");
    } finally {
      setWorkSavingIds((prev) => {
        const next = { ...prev };
        delete next[localKey];
        return next;
      });
    }
  }

  async function deleteWorkEntry(index: number) {
    const row = workExperiences[index];
    if (!row) return;

    setError(null);
    setMessage(null);
    try {
      if (row.id) {
        const res = await fetch(`/api/student/work-experience/${row.id}`, { method: "DELETE" });
        const json = await res.json() as { error?: string };
        if (!res.ok) {
          throw new Error(json.error || "Failed to delete work experience");
        }
      }

      setWorkExperiences((prev) => prev.filter((_, i) => i !== index));
      setMessage("Work experience deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete work experience");
    }
  }

  async function uploadImage(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Profile photo must be 2MB or less.");
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("preserveOriginal", "true");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json() as { urls?: string[]; error?: string; message?: string };
      if (!res.ok || !json.urls?.[0]) {
        throw new Error(json.error || "Upload failed");
      }
      setPersonal((prev) => ({ ...prev, profilePhotoUrl: json.urls![0] }));
      if (json.message) {
        setMessage(json.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadAndScanPassport(file: File) {
    setPassportUploading(true);
    setError(null);
    setMessage(null);
    setPassport((prev) => ({ ...prev, ocrStatus: "VERIFYING" }));

    try {
      const fd = new FormData();
      fd.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const scanRes = await fetch("/api/student/profile/document-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "PASSPORT",
          fileUrl: uploadJson.urls[0],
          fileName: file.name,
        }),
      });
      const scanJson = await scanRes.json() as {
        data?: {
          documentId: string;
          ocrStatus: string;
          detected: { name: string; number: string; expiry: string };
          error: string | null;
          message?: string;
          usedAnthropicFallback?: boolean;
        };
        error?: string;
      };

      if (!scanRes.ok || !scanJson.data) {
        throw new Error(scanJson.error || "Passport scan failed");
      }

      setPassport((prev) => ({
        ...prev,
        ocrStatus: scanJson.data?.ocrStatus || "NEEDS_REVIEW",
        lastDocumentId: scanJson.data?.documentId || "",
        passportFileUrl: uploadJson.urls?.[0] || "",
        passportFileName: file.name,
        passportUploadedAt: new Date().toISOString(),
        lastOcrName: scanJson.data?.detected.name || "",
        lastOcrNumber: scanJson.data?.detected.number || "",
        lastOcrExpiry: scanJson.data?.detected.expiry || "",
        passportNumber: scanJson.data?.detected.number || prev.passportNumber,
        expiryDate: scanJson.data?.detected.expiry || prev.expiryDate,
      }));

      const prefix = uploadJson.message ? `${uploadJson.message} ` : "";
      setMessage(`${prefix}${scanJson.data.message || "Document uploaded successfully. Your counsellor will review the document manually."}`);
    } catch {
      setError(null);
      setMessage("Document uploaded successfully. Your counsellor will review the document manually.");
      setPassport((prev) => ({ ...prev, ocrStatus: "NEEDS_REVIEW" }));
    } finally {
      setPassportUploading(false);
    }
  }

  async function confirmPassportOcr(confirmed: boolean) {
    if (!passport.lastDocumentId) {
      setError("Upload passport first.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/student/profile/document-scan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: passport.lastDocumentId,
          confirmed,
          correctedName: passport.lastOcrName,
          correctedNumber: passport.passportNumber || passport.lastOcrNumber,
          correctedExpiry: passport.expiryDate || passport.lastOcrExpiry,
        }),
      });

      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to confirm OCR");
      }

      setPassport((prev) => ({ ...prev, ocrStatus: confirmed ? "VERIFIED" : "NEEDS_REVIEW" }));
      setMessage(confirmed ? "Passport OCR confirmed." : "Passport OCR marked for manual review.");
      await saveTab("passport");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update OCR confirmation");
    } finally {
      setSaving(false);
    }
  }

  async function deletePassportDocument() {
    if (!passport.lastDocumentId) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${passport.lastDocumentId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete passport file");
      }

      setPassport((prev) => ({
        ...prev,
        lastDocumentId: "",
        passportFileUrl: "",
        passportFileName: "",
        passportUploadedAt: "",
        ocrStatus: "",
        lastOcrName: "",
        lastOcrNumber: "",
        lastOcrExpiry: "",
      }));

      await saveTab("passport");
      setMessage("Passport file deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete passport file");
    } finally {
      setSaving(false);
    }
  }

  const fieldOptions = useMemo(() => {
    const q = fieldSearch.toLowerCase().trim();
    if (!q) return PREF_FIELDS;
    return PREF_FIELDS.filter((field) => field.toLowerCase().includes(q));
  }, [fieldSearch]);

  if (loading) {
    return <div className="glass-card mx-auto w-full max-w-7xl rounded-2xl p-6 text-sm text-slate-600 dark:text-slate-300">Loading profile...</div>;
  }

  return (
    <div className="student-dashboard-bg mx-auto w-full max-w-7xl space-y-4 rounded-3xl p-2">
      <section className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Profile</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your details, then generate or download your CV anytime.</p>
            <div className="mt-3 w-full max-w-sm">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>Profile completion</span>
                <span>{profileCompletion}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/60 dark:bg-slate-800/70">
                <div className="h-full rounded-full bg-gradient-to-r from-[#1E3A5F] to-[#3b78ad] transition-all dark:from-[#F5A623] dark:to-[#d48b0b]" style={{ width: `${profileCompletion}%` }} />
              </div>
            </div>
          </div>
          <Link
            href="/student/cv-builder"
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#F5A623] to-[#de920a] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:opacity-95 dark:text-slate-900"
          >
            Download CV
          </Link>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTabWithHash(tab.key)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-gradient-to-r from-[#1E3A5F] to-[#2f6797] text-white shadow-sm dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900" : "bg-white/60 text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "personal" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Personal Info</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>First Name</FieldLabel>
              <Input value={personal.firstName} onChange={(e) => setPersonal((prev) => ({ ...prev, firstName: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Last Name</FieldLabel>
              <Input value={personal.lastName} onChange={(e) => setPersonal((prev) => ({ ...prev, lastName: e.target.value }))} />
            </div>

            <div>
              <FieldLabel>Email</FieldLabel>
              <Input value={personal.email} readOnly disabled className="bg-slate-100/70 dark:bg-slate-800/80" />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                <Select value={personal.dialCode} onChange={(e) => setPersonal((prev) => ({ ...prev, dialCode: e.target.value }))}>
                  {DIAL_CODES.map((item) => (
                    <option key={item.code} value={item.code}>{item.code} ({item.country})</option>
                  ))}
                </Select>
                <Input className="col-span-2" value={personal.phone} onChange={(e) => setPersonal((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>

            <div>
              <FieldLabel>Date of Birth</FieldLabel>
              <Input type="date" value={personal.dateOfBirth || ""} onChange={(e) => setPersonal((prev) => ({ ...prev, dateOfBirth: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Gender (Optional)</FieldLabel>
              <Select value={personal.gender || ""} onChange={(e) => setPersonal((prev) => ({ ...prev, gender: e.target.value }))}>
                {GENDERS.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}
              </Select>
            </div>

            <div>
              <FieldLabel>Nationality</FieldLabel>
              <Input list="country-options" value={personal.nationality || ""} onChange={(e) => setPersonal((prev) => ({ ...prev, nationality: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Country of Residence</FieldLabel>
              <Input list="country-options" value={personal.countryOfResidence || ""} onChange={(e) => setPersonal((prev) => ({ ...prev, countryOfResidence: e.target.value }))} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-white/40 bg-white/70 dark:border-white/10 dark:bg-slate-800/80">
              {personal.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={personal.profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-white/50 bg-white/70 px-4 text-sm font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900">
              {uploadingPhoto ? "Uploading..." : "Upload Profile Photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">Circular crop preview. Max size 2MB.</p>
          </div>

          {renderTabActions("personal", true)}
        </section>
      )}

      {activeTab === "address" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Address and Contact</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><FieldLabel>Street</FieldLabel><Input value={address.street} onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))} /></div>
            <div><FieldLabel>City</FieldLabel><Input value={address.city} onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))} /></div>
            <div><FieldLabel>State / Province</FieldLabel><Input value={address.state} onChange={(e) => setAddress((prev) => ({ ...prev, state: e.target.value }))} /></div>
            <div><FieldLabel>Postal Code</FieldLabel><Input value={address.postalCode} onChange={(e) => setAddress((prev) => ({ ...prev, postalCode: e.target.value }))} /></div>
            <div><FieldLabel>Country</FieldLabel><Input list="country-options" value={address.country} onChange={(e) => setAddress((prev) => ({ ...prev, country: e.target.value }))} /></div>
          </div>

          <h3 className="mt-6 text-base font-semibold text-slate-900 dark:text-slate-100">Emergency Contact</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div><FieldLabel>Name</FieldLabel><Input value={address.emergencyName} onChange={(e) => setAddress((prev) => ({ ...prev, emergencyName: e.target.value }))} /></div>
            <div><FieldLabel>Relationship</FieldLabel><Input value={address.emergencyRelationship} onChange={(e) => setAddress((prev) => ({ ...prev, emergencyRelationship: e.target.value }))} /></div>
            <div><FieldLabel>Phone</FieldLabel><Input value={address.emergencyPhone} onChange={(e) => setAddress((prev) => ({ ...prev, emergencyPhone: e.target.value }))} /></div>
            <div><FieldLabel>Email</FieldLabel><Input type="email" value={address.emergencyEmail} onChange={(e) => setAddress((prev) => ({ ...prev, emergencyEmail: e.target.value }))} /></div>
          </div>

          {renderTabActions("address", true)}
        </section>
      )}

      {activeTab === "passport" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Passport and ID</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><FieldLabel>Passport Number</FieldLabel><Input value={passport.passportNumber} onChange={(e) => setPassport((prev) => ({ ...prev, passportNumber: e.target.value }))} /></div>
            <div><FieldLabel>Country of Issue</FieldLabel><Input list="country-options" value={passport.countryOfIssue} onChange={(e) => setPassport((prev) => ({ ...prev, countryOfIssue: e.target.value }))} /></div>
            <div><FieldLabel>Date of Issue</FieldLabel><Input type="date" value={passport.dateOfIssue || ""} onChange={(e) => setPassport((prev) => ({ ...prev, dateOfIssue: e.target.value }))} /></div>
            <div><FieldLabel>Expiry Date</FieldLabel><Input type="date" value={passport.expiryDate || ""} onChange={(e) => setPassport((prev) => ({ ...prev, expiryDate: e.target.value }))} /></div>
          </div>

          <div className="mt-5">
            <ChecklistUploadZone
              onFileSelected={uploadAndScanPassport}
              uploading={passportUploading}
              studentId={studentId || undefined}
              documentField="PASSPORT"
              documentType="PASSPORT"
            />
          </div>

          {passport.passportFileUrl && passport.lastDocumentId ? (
            <div className="mt-4 rounded-xl border border-white/50 bg-white/60 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Uploaded passport file</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{passport.passportFileName || "Passport document"}</p>
              {passport.passportUploadedAt ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Uploaded: {new Date(passport.passportUploadedAt).toLocaleString()}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPassportPreviewOpen(true)}
                  className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Preview
                </button>
                <a
                  href={toApiFilesDownloadPath(passport.passportFileUrl)}
                  className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => void deletePassportDocument()}
                  className="rounded-lg border border-rose-300/70 bg-rose-50/80 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur-sm dark:bg-slate-900/60 dark:text-slate-200">
            OCR Status: {passport.ocrStatus || "NEEDS_REVIEW"}
          </div>

          {passport.lastOcrNumber || passport.lastOcrName || passport.lastOcrExpiry ? (
            <div className="mt-4 rounded-xl border border-white/50 bg-white/60 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50">
              <p className="text-sm text-slate-700 dark:text-slate-300">We detected <strong>{passport.lastOcrName || "-"}</strong>, <strong>{passport.lastOcrNumber || "-"}</strong>, <strong>{passport.lastOcrExpiry || "-"}</strong>. Is this correct?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void confirmPassportOcr(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Yes confirm</button>
                <button type="button" onClick={() => void confirmPassportOcr(false)} className="rounded-lg border border-white/50 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900">No - open edit fields</button>
              </div>
            </div>
          ) : null}

          {renderTabActions("passport", true)}
        </section>
      )}

      {activeTab === "academic" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Academic Profile</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Embedded module editor from Module 18.5.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/40 dark:border-white/10">
            <iframe src="/student/profile/academic" className="h-[960px] w-full bg-white dark:bg-slate-900" title="Academic Profile" />
          </div>
          <Link href="/student/profile/academic" className="mt-4 inline-flex h-11 items-center rounded-xl border border-white/50 bg-white/70 px-4 text-sm font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900">Open in full page</Link>
          {renderTabActions("academic", false)}
        </section>
      )}

      {activeTab === "work" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Work Experience</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Include your recent roles to strengthen your CV profile.</p>

          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Do you have work experience?</p>
            <button
              type="button"
              onClick={() => setWork({ hasWorkExperience: true })}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${work.hasWorkExperience ? "bg-[#1E3A5F] text-white dark:bg-[#F5A623] dark:text-slate-900" : "bg-white/70 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"}`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                setWork({ hasWorkExperience: false });
                setWorkExperiences([]);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${work.hasWorkExperience === false ? "bg-[#1E3A5F] text-white dark:bg-[#F5A623] dark:text-slate-900" : "bg-white/70 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"}`}
            >
              No
            </button>
          </div>

          {work.hasWorkExperience === true && (
            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={() => setWorkExperiences((prev) => [...prev, createEmptyWorkEntry()])}
                className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white"
              >
                + Add Work Experience
              </button>

              {workExperiences.length === 0 ? (
                <div className="rounded-lg border border-white/40 bg-white/60 p-4 text-sm text-slate-600 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300">
                  Add your first role, then save it.
                </div>
              ) : null}

              {workExperiences.map((entry, index) => {
                const savingKey = entry.id || `tmp-${index}`;
                const isSavingEntry = Boolean(workSavingIds[savingKey]);

                return (
                  <article key={entry.id || `new-${index}`} className="rounded-xl border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/30">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Employer Name</FieldLabel>
                        <Input value={entry.employerName} onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? { ...row, employerName: e.target.value } : row))} />
                      </div>
                      <div>
                        <FieldLabel>Job Title</FieldLabel>
                        <Input value={entry.jobTitle} onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? { ...row, jobTitle: e.target.value } : row))} />
                      </div>
                      <div>
                        <FieldLabel>Location</FieldLabel>
                        <Input value={entry.location} onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? { ...row, location: e.target.value } : row))} />
                      </div>
                      <div>
                        <FieldLabel>Start Date</FieldLabel>
                        <Input type="date" value={entry.startDate || ""} onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? { ...row, startDate: e.target.value } : row))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={entry.isCurrentlyWorking}
                            onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? {
                              ...row,
                              isCurrentlyWorking: e.target.checked,
                              endDate: e.target.checked ? "" : row.endDate,
                            } : row))}
                          />
                          I currently work here
                        </label>
                      </div>
                      {!entry.isCurrentlyWorking ? (
                        <div>
                          <FieldLabel>End Date</FieldLabel>
                          <Input type="date" value={entry.endDate || ""} onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? { ...row, endDate: e.target.value } : row))} />
                        </div>
                      ) : null}
                      <div className="md:col-span-2">
                        <FieldLabel>Main Responsibilities</FieldLabel>
                        <TextArea rows={4} value={entry.responsibilities} onChange={(e) => setWorkExperiences((prev) => prev.map((row, i) => i === index ? { ...row, responsibilities: e.target.value } : row))} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveWorkEntry(index)}
                        disabled={isSavingEntry}
                        className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {isSavingEntry ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteWorkEntry(index)}
                        className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {renderTabActions("work", true)}
        </section>
      )}

      {activeTab === "tests" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          {studentId ? (
            <TestScoresManager studentId={studentId} canManage={true} title="Test Scores" />
          ) : (
            <div className="rounded-lg border border-white/40 bg-white/60 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300">Loading test score module...</div>
          )}

          {renderTabActions("tests", false)}
        </section>
      )}

      {activeTab === "immigration" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2c628f] p-4 text-white dark:from-[#F5A623] dark:to-[#d48b0b] dark:text-slate-900">
            <p className="text-sm font-semibold">This information is strictly confidential.</p>
            <p className="mt-1 text-sm">It will NEVER be shared with any university or third party.</p>
            <p className="mt-1 text-sm">It is used only by EduQuantica counsellors to provide you with the best possible advice.</p>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Have you ever been refused a visa to any country?</p>
            <button type="button" onClick={() => setImmigration((prev) => ({ ...prev, hasVisaRefusal: true }))} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${immigration.hasVisaRefusal ? "bg-[#1E3A5F] text-white dark:bg-[#F5A623] dark:text-slate-900" : "bg-white/70 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"}`}>Yes</button>
            <button type="button" onClick={() => setImmigration((prev) => ({ ...prev, hasVisaRefusal: false, refusals: [] }))} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${!immigration.hasVisaRefusal ? "bg-[#1E3A5F] text-white dark:bg-[#F5A623] dark:text-slate-900" : "bg-white/70 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"}`}>No</button>
          </div>

          {immigration.hasVisaRefusal && (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setImmigration((prev) => ({
                  ...prev,
                  refusals: [...prev.refusals, {
                    id: uid(),
                    country: "",
                    visaType: "Student",
                    refusalMonth: "",
                    refusalYear: "",
                    reason: "",
                    resolved: false,
                    resolutionDetails: "",
                  }],
                }))}
                className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white"
              >
                + Add Refusal
              </button>

              {immigration.refusals.map((refusal) => (
                <article key={refusal.id} className="rounded-xl border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/30">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><FieldLabel>Country of refusal</FieldLabel><Input list="country-options" value={refusal.country} onChange={(e) => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, country: e.target.value } : row) }))} /></div>
                    <div><FieldLabel>Visa type</FieldLabel><Select value={refusal.visaType} onChange={(e) => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, visaType: e.target.value } : row) }))}><option>Student</option><option>Work</option><option>Tourist</option><option>Other</option></Select></div>
                    <div><FieldLabel>Month</FieldLabel><Select value={refusal.refusalMonth} onChange={(e) => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, refusalMonth: e.target.value } : row) }))}><option value="">Select month</option>{["January","February","March","April","May","June","July","August","September","October","November","December"].map((m)=><option key={m}>{m}</option>)}</Select></div>
                    <div><FieldLabel>Year</FieldLabel><Input type="number" value={refusal.refusalYear} onChange={(e) => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, refusalYear: e.target.value } : row) }))} /></div>
                    <div className="md:col-span-2"><FieldLabel>Brief reason given (optional)</FieldLabel><TextArea rows={3} value={refusal.reason} onChange={(e) => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, reason: e.target.value } : row) }))} /></div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Has this been resolved?</span>
                    <button type="button" onClick={() => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, resolved: true } : row) }))} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${refusal.resolved ? "bg-[#1E3A5F] text-white dark:bg-[#F5A623] dark:text-slate-900" : "bg-white/70 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"}`}>Yes</button>
                    <button type="button" onClick={() => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, resolved: false, resolutionDetails: "" } : row) }))} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${!refusal.resolved ? "bg-[#1E3A5F] text-white dark:bg-[#F5A623] dark:text-slate-900" : "bg-white/70 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"}`}>No</button>
                  </div>

                  {refusal.resolved && (
                    <div className="mt-3"><FieldLabel>Explain how it was resolved</FieldLabel><TextArea rows={3} value={refusal.resolutionDetails} onChange={(e) => setImmigration((prev) => ({ ...prev, refusals: prev.refusals.map((row) => row.id === refusal.id ? { ...row, resolutionDetails: e.target.value } : row) }))} /></div>
                  )}
                </article>
              ))}

              <p className="rounded-lg border border-blue-200/70 bg-blue-50/85 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">Having a visa refusal does not automatically prevent you from applying. Your counsellor will advise on the best approach.</p>
            </div>
          )}

          {renderTabActions("immigration", true)}
        </section>
      )}

      {activeTab === "preferences" && (
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preferences</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Preferred Study Destination</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {DESTINATION_COUNTRIES.map((dest) => (
                  <label key={dest} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={preferences.preferredDestinations.includes(dest)}
                      onChange={(e) => setPreferences((prev) => ({
                        ...prev,
                        preferredDestinations: e.target.checked
                          ? [...prev.preferredDestinations, dest]
                          : prev.preferredDestinations.filter((item) => item !== dest),
                      }))}
                    />
                    {dest}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Preferred Level of Study</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {PREF_LEVELS.map((level) => (
                  <label key={level} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={preferences.preferredStudyLevels.includes(level)}
                      onChange={(e) => setPreferences((prev) => ({
                        ...prev,
                        preferredStudyLevels: e.target.checked
                          ? [...prev.preferredStudyLevels, level]
                          : prev.preferredStudyLevels.filter((item) => item !== level),
                      }))}
                    />
                    {level}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <FieldLabel>Preferred Field of Study</FieldLabel>
              <Input placeholder="Search field" value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} />
              <div className="mt-2 grid max-h-44 grid-cols-2 gap-2 overflow-auto rounded-lg border border-white/40 bg-white/40 p-2 dark:border-white/10 dark:bg-slate-900/30 md:grid-cols-3">
                {fieldOptions.map((field) => (
                  <label key={field} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={preferences.preferredFields.includes(field)}
                      onChange={(e) => setPreferences((prev) => ({
                        ...prev,
                        preferredFields: e.target.checked
                          ? [...prev.preferredFields, field]
                          : prev.preferredFields.filter((item) => item !== field),
                      }))}
                    />
                    {field}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Preferred Intake Period</FieldLabel>
              <Select value={preferences.preferredIntake} onChange={(e) => setPreferences((prev) => ({ ...prev, preferredIntake: e.target.value }))}>
                <option>January</option>
                <option>May</option>
                <option>September</option>
                <option>Any</option>
              </Select>
            </div>

            <div>
              <FieldLabel>Maximum Annual Tuition Budget</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                <Input className="col-span-2" type="number" value={preferences.tuitionBudget} onChange={(e) => setPreferences((prev) => ({ ...prev, tuitionBudget: e.target.value }))} />
                <Select value={preferences.tuitionBudgetCurrency} onChange={(e) => setPreferences((prev) => ({ ...prev, tuitionBudgetCurrency: e.target.value }))}>
                  {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                </Select>
              </div>
            </div>

            <div>
              <FieldLabel>Preferred Currency Display</FieldLabel>
              <Select value={preferences.preferredCurrencyDisplay} onChange={(e) => setPreferences((prev) => ({ ...prev, preferredCurrencyDisplay: e.target.value }))}>
                <option value="">Auto</option>
                {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
              </Select>
            </div>

            <div>
              <FieldLabel>Communication Language</FieldLabel>
              <Select value={preferences.communicationLanguage} onChange={(e) => setPreferences((prev) => ({ ...prev, communicationLanguage: e.target.value }))}>
                <option>English</option>
                <option>Bengali</option>
                <option>Hindi</option>
                <option>Urdu</option>
                <option>Arabic</option>
                <option>French</option>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-white/40 bg-white/40 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
              <span>Email Notifications</span>
              <input type="checkbox" checked={preferences.emailNotifications} onChange={(e) => setPreferences((prev) => ({ ...prev, emailNotifications: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-white/40 bg-white/40 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
              <span>SMS Notifications</span>
              <input type="checkbox" checked={preferences.smsNotifications} onChange={(e) => setPreferences((prev) => ({ ...prev, smsNotifications: e.target.checked }))} />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/30">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notification Preferences</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose where you receive finance and message updates.</p>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/50 text-left text-slate-600 dark:border-white/10 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">In App</th>
                    <th className="py-2 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/40 dark:border-white/10">
                    <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">Finance</td>
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={preferences.financePortalNotifications}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, financePortalNotifications: e.target.checked }))}
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={preferences.financeEmailNotifications}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, financeEmailNotifications: e.target.checked }))}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">Messages</td>
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={preferences.messagePortalNotifications}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, messagePortalNotifications: e.target.checked }))}
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={preferences.messageEmailNotifications}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, messageEmailNotifications: e.target.checked }))}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {renderTabActions("preferences", true)}
        </section>
      )}

      <datalist id="country-options">
        {COUNTRIES.map((country) => <option key={country} value={country} />)}
      </datalist>

      {passportPreviewOpen && passport.passportFileUrl ? (
        <DocumentPreviewModal
          fileUrl={passport.passportFileUrl}
          fileName={passport.passportFileName || "Passport"}
          onClose={() => setPassportPreviewOpen(false)}
        />
      ) : null}

      {error && <div className="rounded-lg border border-rose-200/80 bg-rose-50/90 p-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-3 text-sm text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}
    </div>
  );
}
