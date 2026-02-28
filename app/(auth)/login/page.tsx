"use client";

import { useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { getPortalPath } from "@/lib/portal";

type SessionUserExtras = {
  roleName?: string;
  subAgentApproved?: boolean;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect away from /login
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getSession();
      if (cancelled) return;

      const user = (session?.user ?? {}) as SessionUserExtras;
      if (session?.user && user.roleName) {
        const destination = getPortalPath(user.roleName, user.subAgentApproved);
        router.replace(destination);
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError("Invalid email or password");
        return;
      }

      // Now fetch the session (should include roleName, permissions, etc.)
      const session = await getSession();
      const user = (session?.user ?? {}) as SessionUserExtras;

      if (!session?.user || !user.roleName) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      const destination = getPortalPath(user.roleName, user.subAgentApproved);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-0px)] w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">EduQuantica CRM</h1>
            <p className="text-blue-100 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm
                           text-slate-900 placeholder-slate-400 shadow-sm outline-none
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  Forgot your password?
                </Link>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10
                             text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none
                             focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5
                         text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60
                         disabled:cursor-not-allowed transition focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Footer links */}
          <div className="px-8 pb-8 text-center text-sm text-slate-500">
            <div className="border-t border-slate-100 pt-6 space-y-2">
              <Link href="/register" className="block text-blue-600 hover:underline font-medium">
                New student? Create your profile
              </Link>
              <Link
                href="/agent/apply"
                className="block text-slate-600 hover:text-blue-600 hover:underline"
              >
                Recruitment partner? Apply here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}