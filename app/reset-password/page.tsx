"use client";

import { Suspense } from "react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset email.");
    }
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to reset password.");
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.push("/login");
      }, 1200);
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
          <h1 className="mt-2 text-2xl font-bold">Reset Password</h1>
          <p className="mt-1 text-sm text-white/80">Set a new password for your account.</p>
        </div>

        <div className="px-6 py-6">
          {done ? (
            <p className="text-sm text-slate-700">Password updated successfully. Redirecting to login...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#d4a63d] px-4 py-2.5 text-sm font-semibold text-[#12264a] hover:bg-[#c7972f] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Resetting..." : "Reset password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0f1f3b] px-4 py-10">
          <div className="mx-auto flex w-full max-w-md items-center justify-center rounded-2xl border border-[#f3c96a]/40 bg-white p-8 shadow-xl">
            <Loader2 className="h-6 w-6 animate-spin text-[#12264a]" />
          </div>
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
