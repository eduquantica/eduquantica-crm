"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { DESTINATION_COUNTRIES } from "@/lib/countries";

type ProfilePayload = {
  data: {
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

const LEVEL_OPTIONS = ["Foundation", "Undergraduate", "Postgraduate", "PhD"];
const FIELD_OPTIONS = [
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

type Props = {
  studentId: string;
  firstName: string;
  initialDateOfBirth: string;
  initialCountryOfResidence: string;
  counsellorName: string;
  initialProfileCompletion: number;
  initialQualificationCount: number;
  initialEduviStarted: boolean;
};

function StepProgress({ step }: { step: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>Step {step} of 5</span>
        <span>{Math.round((step / 5) * 100)}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${(step / 5) * 100}%` }} />
      </div>
    </div>
  );
}

export default function OnboardingWizard({
  firstName,
  initialDateOfBirth,
  initialCountryOfResidence,
  counsellorName,
  initialProfileCompletion,
  initialQualificationCount,
  initialEduviStarted,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingStep2, setSavingStep2] = useState(false);
  const [checkingQualifications, setCheckingQualifications] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [countryOfResidence, setCountryOfResidence] = useState(initialCountryOfResidence);
  const [preferredDestinations, setPreferredDestinations] = useState<string[]>([]);
  const [preferredLevels, setPreferredLevels] = useState<string[]>([]);
  const [preferredFields, setPreferredFields] = useState<string[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");
  const [qualificationCount, setQualificationCount] = useState(initialQualificationCount);
  const [eduviStarted, setEduviStarted] = useState(initialEduviStarted);
  const [profileCompletion, setProfileCompletion] = useState(initialProfileCompletion);
  const [error, setError] = useState<string | null>(null);

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return FIELD_OPTIONS;
    return FIELD_OPTIONS.filter((field) => field.toLowerCase().includes(q));
  }, [fieldSearch]);

  async function loadProfileData() {
    if (loadingProfile) return;
    setLoadingProfile(true);
    setError(null);

    try {
      const res = await fetch("/api/student/profile", { cache: "no-store" });
      const json = (await res.json()) as ProfilePayload | { error: string };
      if (!res.ok || !("data" in json)) {
        throw new Error("error" in json ? json.error : "Failed to load profile");
      }

      setDateOfBirth(json.data.personal.dateOfBirth || "");
      setCountryOfResidence(json.data.personal.countryOfResidence || "");
      setPreferredDestinations(json.data.preferences.preferredDestinations || []);
      setPreferredLevels(json.data.preferences.preferredStudyLevels || []);
      setPreferredFields(json.data.preferences.preferredFields || []);
      if (typeof json.data.completion?.percentage === "number") {
        setProfileCompletion(json.data.completion.percentage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function saveStep2() {
    setSavingStep2(true);
    setError(null);

    try {
      const profileRes = await fetch("/api/student/profile", { cache: "no-store" });
      const profileJson = (await profileRes.json()) as ProfilePayload | { error: string };
      if (!profileRes.ok || !("data" in profileJson)) {
        throw new Error("error" in profileJson ? profileJson.error : "Failed to load profile");
      }

      const personalPayload = {
        ...profileJson.data.personal,
        dateOfBirth: dateOfBirth || null,
        countryOfResidence: countryOfResidence || "",
      };

      const preferencesPayload = {
        ...profileJson.data.preferences,
        preferredDestinations,
        preferredStudyLevels: preferredLevels,
        preferredFields,
      };

      const [personalSaveRes, preferencesSaveRes] = await Promise.all([
        fetch("/api/student/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: "personal", data: personalPayload }),
        }),
        fetch("/api/student/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: "preferences", data: preferencesPayload }),
        }),
      ]);

      if (!personalSaveRes.ok || !preferencesSaveRes.ok) {
        throw new Error("Failed to save your preferences");
      }

      const [personalSaveJson, preferencesSaveJson] = await Promise.all([
        personalSaveRes.json() as Promise<{ data?: { completion?: { percentage?: number } } }>,
        preferencesSaveRes.json() as Promise<{ data?: { completion?: { percentage?: number } } }>,
      ]);
      const completionPercentage =
        preferencesSaveJson.data?.completion?.percentage ??
        personalSaveJson.data?.completion?.percentage;
      if (typeof completionPercentage === "number") {
        setProfileCompletion(completionPercentage);
      }

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save step");
    } finally {
      setSavingStep2(false);
    }
  }

  async function refreshQualifications() {
    setCheckingQualifications(true);
    setError(null);

    try {
      const res = await fetch("/api/student/academic-profile", { cache: "no-store" });
      const json = (await res.json()) as { data?: { qualifications?: Array<unknown> }; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Failed to check qualifications");
      }
      const count = json.data.qualifications?.length || 0;
      setQualificationCount(count);
      const profileRes = await fetch("/api/student/profile", { cache: "no-store" });
      const profileJson = (await profileRes.json()) as ProfilePayload | { error: string };
      if (profileRes.ok && "data" in profileJson && typeof profileJson.data.completion?.percentage === "number") {
        setProfileCompletion(profileJson.data.completion.percentage);
      }
      if (count > 0) setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check qualifications");
    } finally {
      setCheckingQualifications(false);
    }
  }

  async function handleEduviStart() {
    await fetch("/api/student/onboarding/eduvi-started", { method: "POST" }).catch(() => undefined);
    setEduviStarted(true);
    window.open("/student/messages#eduvi", "_blank", "noopener,noreferrer");
  }

  async function completeOnboarding() {
    setCompleting(true);
    setError(null);

    try {
      const completeRes = await fetch("/api/student/onboarding/complete", { method: "POST" });
      const completeJson = (await completeRes.json()) as { error?: string };
      if (!completeRes.ok) {
        throw new Error(completeJson.error || "Failed to complete onboarding");
      }
      router.push("/student/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding");
    } finally {
      setCompleting(false);
    }
  }

  function toggleValue(list: string[], value: string, setter: (next: string[]) => void) {
    if (list.includes(value)) {
      setter(list.filter((item) => item !== value));
      return;
    }
    setter([...list, value]);
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <StepProgress step={step} />
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {step === 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">Hi {firstName}! Welcome to EduQuantica.</h1>
          <p className="mt-2 text-sm text-slate-600">
            You can find courses, track applications, upload documents, and get guidance from Eduvi and your counsellor.
          </p>
          <button
            type="button"
            onClick={async () => {
              await loadProfileData();
              setStep(2);
            }}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Let&apos;s get you set up
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Tell us about you</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Country of Residence</label>
              <input
                value={countryOfResidence}
                onChange={(e) => setCountryOfResidence(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Country"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-800">Preferred Study Destination</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {DESTINATION_COUNTRIES.map((dest) => (
                <label key={dest} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={preferredDestinations.includes(dest)}
                    onChange={() => toggleValue(preferredDestinations, dest, setPreferredDestinations)}
                  />
                  {dest}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-800">Preferred Level of Study</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {LEVEL_OPTIONS.map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={preferredLevels.includes(level)}
                    onChange={() => toggleValue(preferredLevels, level, setPreferredLevels)}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-800">Preferred Field of Study</p>
            <input
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Search fields"
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {filteredFields.map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={preferredFields.includes(field)}
                    onChange={() => toggleValue(preferredFields, field, setPreferredFields)}
                  />
                  {field}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button type="button" onClick={() => setStep(3)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => void saveStep2()}
              disabled={savingStep2}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingStep2 ? "Saving..." : "Next"}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Your qualifications</h2>
          <p className="mt-2 text-sm text-slate-600">Add at least one qualification to improve matching and eligibility guidance.</p>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {qualificationCount > 0 ? `Great! You have added ${qualificationCount} qualification(s).` : "No qualification detected yet."}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/student/profile/academic"
              target="_blank"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add Your Qualifications
            </Link>
            <button
              type="button"
              onClick={() => void refreshQualifications()}
              disabled={checkingQualifications}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {checkingQualifications ? "Checking..." : "I&apos;ve added qualifications"}
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button type="button" onClick={() => setStep(4)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Chat with Eduvi</h2>
          <p className="mt-2 text-sm text-slate-600">Meet Eduvi, your personal study adviser.</p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Eduvi Preview</p>
              <p className="mt-1">Hi! I can help you shortlist courses, understand entry requirements, and plan your next steps.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleEduviStart()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <MessageCircle className="h-4 w-4" />
              Start Chatting with Eduvi
            </button>
            {eduviStarted ? <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Started</span> : null}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button type="button" onClick={() => setStep(5)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">You are all set!</h2>
          <p className="mt-2 text-sm text-slate-600">Profile is {profileCompletion}% complete.</p>
          <p className="mt-1 text-sm text-slate-600">Your assigned counsellor is {counsellorName}. They will be in touch soon.</p>

          <button
            type="button"
            onClick={() => void completeOnboarding()}
            disabled={completing}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Go to My Dashboard
          </button>
        </section>
      )}
    </main>
  );
}
