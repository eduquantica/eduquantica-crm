"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error || "Unable to process request.");
        return;
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f1f3b] px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#f3c96a]/40 bg-white shadow-xl">
        <div className="rounded-t-2xl bg-[#12264a] px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f3c96a]">EduQuantica</p>
          <h1 className="mt-2 text-2xl font-bold">Forgot Password</h1>
          <p className="mt-1 text-sm text-white/80">Request a secure reset link.</p>
        </div>

        <div className="px-6 py-6">
          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                If an account exists for <span className="font-medium">{email}</span>, a password reset email has been sent.
              </p>
              <Link href="/login" className="text-sm font-medium text-[#12264a] underline">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#d4a63d] px-4 py-2.5 text-sm font-semibold text-[#12264a] hover:bg-[#c7972f] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending..." : "Send reset email"}
              </button>
              <p className="text-center">
                <Link href="/login" className="text-sm font-medium text-[#12264a] underline">Back to login</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
