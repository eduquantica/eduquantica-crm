"use client";

import { FormEvent, useState } from "react";

export default function ConfirmReferralPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    referralCode: string;
    alreadyConfirmed: boolean;
    providerConfirmedAt?: string;
    providerName: string;
    listingTitle: string;
    studentName?: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length !== 8) {
      setError("Please enter the 8-character referral code from your email.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/public/confirm-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: trimmed }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Failed to confirm referral.");
        return;
      }
      setResult(json.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F5A623]">EduQuantica</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Provider Referral Confirmation</h1>
          <p className="mt-2 text-sm text-slate-600">
            If a student was referred to you through EduQuantica, please confirm receipt of the referral by entering the code from the email you received.
          </p>
        </div>

        {result ? (
          <div className={`space-y-3 rounded-lg border p-4 text-sm ${result.alreadyConfirmed ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-800"}`}>
            {result.alreadyConfirmed ? (
              <>
                <p className="text-base font-semibold">Already confirmed</p>
                <p>Referral code <span className="font-mono font-bold">{result.referralCode}</span> was already confirmed
                  {result.providerConfirmedAt ? ` on ${new Date(result.providerConfirmedAt).toLocaleDateString()}` : ""}.</p>
                <p>Thank you, {result.providerName}.</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Referral confirmed successfully!</p>
                <p>Thank you, <strong>{result.providerName}</strong>.</p>
                <p>You have confirmed receipt of referral code <span className="font-mono font-bold">{result.referralCode}</span> for the listing: <strong>{result.listingTitle}</strong>.</p>
                {result.studentName ? <p>Student: <strong>{result.studentName}</strong></p> : null}
                <p className="text-xs text-green-700">
                  This confirmation has been recorded by EduQuantica and our commission agreement is now active for this referral. Please quote code <span className="font-mono font-bold">{result.referralCode}</span> in any communications with EduQuantica.
                </p>
              </>
            )}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Referral Code</span>
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={8}
                placeholder="e.g. AB12CD34"
                className="mt-1 block w-full rounded-md border px-3 py-2.5 text-center font-mono text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">Enter the 8-character code from the EduQuantica email.</p>
            </label>

            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              By confirming this referral, you acknowledge that the student was introduced to your services by EduQuantica and that our commission agreement applies to this placement.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#1B2A4A] py-3 text-sm font-semibold text-white hover:bg-[#162240] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Confirming..." : "Confirm Referral"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">
          Questions? Contact us at{" "}
          <a href="mailto:info@eduquantica.com" className="underline">info@eduquantica.com</a>
        </p>
      </div>
    </main>
  );
}
