"use client";

import { useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { getPortalPath } from "@/lib/portal";
import BrandLogo from "@/components/ui/BrandLogo";

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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const message = new URLSearchParams(window.location.search).get("message");
    setInfoMessage(message);
  }, []);

  // If already logged in, redirect away from /login
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getSession();
      if (cancelled) return;

      const user = (session?.user ?? {}) as SessionUserExtras;
      console.log("[LOGIN] Initial session check:", {
        hasSession: !!session?.user,
        email: session?.user?.email,
        roleName: user.roleName,
      });

      if (session?.user && user.roleName) {
        const destination = getPortalPath(user.roleName, user.subAgentApproved);
        console.log("[LOGIN] Redirecting to:", destination);
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
      console.log("[LOGIN] Submitting credentials:", { email });
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("[LOGIN] SignIn response:", {
        ok: res?.ok,
        error: res?.error,
        status: res?.status,
      });

      if (!res || res.error) {
        setError("Invalid email or password");
        return;
      }

      // Now fetch the session (should include roleName, permissions, etc.)
      const session = await getSession();
      const user = (session?.user ?? {}) as SessionUserExtras;

      console.log("[LOGIN] Post-signin session check:", {
        hasSession: !!session?.user,
        email: session?.user?.email,
        roleName: user.roleName,
      });

      if (!session?.user || !user.roleName) {
        console.error("[LOGIN] Session missing or no roleName:", {
          hasSession: !!session?.user,
          roleName: user.roleName,
        });
        setError("Sign-in failed. Please try again.");
        return;
      }

      const destination = getPortalPath(user.roleName, user.subAgentApproved);
      console.log("[LOGIN] Redirecting to:", destination);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("[LOGIN] Catch error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-5">
      <section className="relative lg:col-span-3 bg-[#1B2A4A] text-white px-8 py-14 lg:px-16 lg:py-20 flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,166,35,0.28),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(245,166,35,0.2),transparent_30%)]" />
        <div className="relative max-w-xl mx-auto w-full space-y-8">
          <BrandLogo variant="white" width={360} priority />
          <div>
            <h1 className="text-4xl font-bold leading-tight">Empowering Global Education</h1>
            <p className="mt-3 text-white/80 text-base">
              Streamline student recruitment, applications, and communication from one modern CRM.
            </p>
          </div>
          <ul className="space-y-3 text-sm lg:text-base">
            {[
              "Real-time lead and application tracking",
              "Automated document and visa workflow",
              "Unified team and partner collaboration",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="w-5 h-5 text-[#F5A623] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lg:col-span-2 bg-white px-6 py-12 lg:px-12 lg:py-20 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <div className="eq-card p-8 border border-slate-100">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-[#1B2A4A]">Welcome Back</h2>
              <p className="mt-1 text-sm text-slate-500">Sign in to continue to your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {infoMessage && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  {infoMessage}
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900
                             placeholder-slate-400 shadow-sm outline-none focus:border-[#F5A623]
                             focus:ring-2 focus:ring-[#F5A623]/25"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs text-[#F5A623] hover:underline">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm text-slate-900
                               placeholder-slate-400 shadow-sm outline-none focus:border-[#F5A623]
                               focus:ring-2 focus:ring-[#F5A623]/25"
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

              <button
                type="submit"
                disabled={loading}
                className="eq-primary-btn w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm
                           font-semibold shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="mt-7 border-t border-slate-100 pt-5 space-y-2 text-center text-sm">
              <Link href="/register" className="block text-[#F5A623] font-semibold hover:underline">
                New student? Create your profile
              </Link>
              <Link href="/agent/register" className="block text-slate-600 hover:text-[#1B2A4A]">
                Recruitment partner? Apply here
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}