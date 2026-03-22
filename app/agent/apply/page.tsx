"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FieldErrors = Partial<Record<
  | "businessName"
  | "roleAtAgency"
  | "firstName"
  | "lastName"
  | "email"
  | "dialCode"
  | "phoneNumber"
  | "country"
  | "city"
  | "website"
  | "expectedMonthlySubmissions"
  | "heardAboutUs"
  | "document",
  string
>>;

const ROLE_AT_AGENCY = ["Manager", "Director", "Agent", "Owner", "Other"] as const;
const MONTHLY_SUBMISSIONS = ["1-5", "6-15", "16-30", "30+"] as const;
const HEARD_ABOUT_US = ["Google", "Social Media", "Referral", "Conference", "Email", "Other"] as const;

// Keep it simple for now (you can expand later)
const COUNTRIES = ["Bangladesh", "United Kingdom", "Nigeria", "Pakistan", "India", "China"] as const;

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  Bangladesh: ["Dhaka", "Chattogram", "Sylhet", "Khulna"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds"],
  Nigeria: ["Lagos", "Abuja", "Kano"],
  Pakistan: ["Lahore", "Karachi", "Islamabad"],
  India: ["Delhi", "Mumbai", "Bengaluru"],
  China: ["Beijing", "Shanghai", "Shenzhen"],
};

export default function AgentApplyPage() {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [roleAtAgency, setRoleAtAgency] = useState<(typeof ROLE_AT_AGENCY)[number]>("Manager");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [dialCode, setDialCode] = useState("+880");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>("Bangladesh");
  const [city, setCity] = useState("");

  const [website, setWebsite] = useState("");
  const [expectedMonthlySubmissions, setExpectedMonthlySubmissions] =
    useState<(typeof MONTHLY_SUBMISSIONS)[number]>("1-5");

  const [heardAboutUs, setHeardAboutUs] = useState<(typeof HEARD_ABOUT_US)[number]>("Google");

  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cities = useMemo(() => CITIES_BY_COUNTRY[country] ?? [], [country]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!businessName.trim()) errors.businessName = "Business name is required.";
    if (!roleAtAgency) errors.roleAtAgency = "Role at agency is required.";
    if (!firstName.trim()) errors.firstName = "First name is required.";
    if (!lastName.trim()) errors.lastName = "Last name is required.";

    if (!email.trim()) errors.email = "Email is required.";
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter a valid email.";

    if (!dialCode.trim()) errors.dialCode = "Dial code is required.";
    if (!phoneNumber.trim()) errors.phoneNumber = "Phone number is required.";

    if (!country.trim()) errors.country = "Country is required.";
    if (!city.trim()) errors.city = "City is required.";

    if (!expectedMonthlySubmissions) errors.expectedMonthlySubmissions = "Select expected submissions.";
    if (!heardAboutUs) errors.heardAboutUs = "Select how you heard about us.";

    // Optional: file type check
    if (documentFile) {
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(documentFile.type)) {
        errors.document = "File must be PDF/PNG/JPG/WEBP.";
      }
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      // ✅ IMPORTANT: These keys MUST match the API route.ts
      const fd = new FormData();
      fd.append("businessName", businessName.trim());
      fd.append("roleAtAgency", roleAtAgency);
      fd.append("firstName", firstName.trim());
      fd.append("lastName", lastName.trim());
      fd.append("email", email.trim()); // API expects "email"
      fd.append("dialCode", dialCode.trim());
      fd.append("phoneNumber", phoneNumber.trim());
      fd.append("country", country);
      fd.append("city", city.trim());
      fd.append("website", website.trim());
      fd.append("expectedMonthlySubmissions", expectedMonthlySubmissions);
      fd.append("heardAboutUs", heardAboutUs);

      if (documentFile) {
        fd.append("document", documentFile); // API expects "document"
      }

      const res = await fetch("/api/agent/apply", {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Common responses from API
        if (res.status === 409) {
          setFieldErrors((prev) => ({
            ...prev,
            email: data?.error || "An account with this email already exists.",
          }));
          return;
        }

        setSubmitError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      // ✅ Success: API returns redirectUrl
      const redirectUrl = data?.redirectUrl || `/agent/pending?email=${encodeURIComponent(email.trim())}`;
      router.push(redirectUrl);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-8 py-10 text-center">
          <h1 className="text-3xl font-bold text-white">Recruitment Partner Application</h1>
          <p className="text-blue-100 mt-2">Apply to become an EduQuantica Sub-Agent</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6" noValidate>
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              {fieldErrors.businessName && <p className="text-xs text-red-600 mt-1">{fieldErrors.businessName}</p>}
            </div>

            {/* Role at Agency */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Role at Agency</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={roleAtAgency}
                onChange={(e) => setRoleAtAgency(e.target.value as (typeof ROLE_AT_AGENCY)[number])}
              >
                {ROLE_AT_AGENCY.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {fieldErrors.roleAtAgency && <p className="text-xs text-red-600 mt-1">{fieldErrors.roleAtAgency}</p>}
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              {fieldErrors.firstName && <p className="text-xs text-red-600 mt-1">{fieldErrors.firstName}</p>}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              {fieldErrors.lastName && <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Contact Number</label>
              <div className="flex gap-2">
                <input
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                />
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              {(fieldErrors.dialCode || fieldErrors.phoneNumber) && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.dialCode || fieldErrors.phoneNumber}
                </p>
              )}
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={country}
                onChange={(e) => {
                  const c = e.target.value as (typeof COUNTRIES)[number];
                  setCountry(c);
                  setCity(""); // reset city when country changes
                }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {fieldErrors.country && <p className="text-xs text-red-600 mt-1">{fieldErrors.country}</p>}
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">Select a city</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {fieldErrors.city && <p className="text-xs text-red-600 mt-1">{fieldErrors.city}</p>}
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Agency Website (optional)</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="https://..."
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {/* Monthly */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Monthly Student Submissions</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={expectedMonthlySubmissions}
                onChange={(e) => setExpectedMonthlySubmissions(e.target.value as (typeof MONTHLY_SUBMISSIONS)[number])}
              >
                {MONTHLY_SUBMISSIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {fieldErrors.expectedMonthlySubmissions && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.expectedMonthlySubmissions}</p>
              )}
            </div>

            {/* Heard about us (full width) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">How Did You Hear About Us?</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={heardAboutUs}
                onChange={(e) => setHeardAboutUs(e.target.value as (typeof HEARD_ABOUT_US)[number])}
              >
                {HEARD_ABOUT_US.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {fieldErrors.heardAboutUs && <p className="text-xs text-red-600 mt-1">{fieldErrors.heardAboutUs}</p>}
            </div>

            {/* Document (full width) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Upload Agency Registration Document (optional)
              </label>
              <input
                type="file"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                accept=".pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-slate-500 mt-1">Accepted: PDF, PNG, JPG, JPEG, WEBP, HEIC. Images are auto-converted to PDF and large files are auto-compressed.</p>
              {fieldErrors.document && <p className="text-xs text-red-600 mt-1">{fieldErrors.document}</p>}
            </div>
          </div>

          <p className="text-sm text-slate-600">
            By proceeding, you agree to the{" "}
            <Link className="text-blue-600 hover:underline" href="/terms">Terms &amp; Conditions</Link>,{" "}
            <Link className="text-blue-600 hover:underline" href="/privacy">Privacy Policy</Link>{" "}
            and{" "}
            <Link className="text-blue-600 hover:underline" href="/cookies">Cookie Policy</Link>.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 text-white font-semibold py-4 hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>

          <div className="text-center text-sm text-slate-700">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}