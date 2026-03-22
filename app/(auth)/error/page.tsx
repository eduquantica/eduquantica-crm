import Link from "next/link";
import { AlertCircle } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";

type ErrorPageProps = {
  searchParams?: {
    error?: string;
  };
};

const errorMessages: Record<string, string> = {
  Configuration: "Authentication service is temporarily unavailable. Please try again shortly.",
  AccessDenied: "You don’t have permission to access that account.",
  Verification: "Your sign-in link is invalid or expired. Please request a new one.",
  Default: "We couldn’t sign you in due to an authentication error. Please try again.",
};

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const errorCode = searchParams?.error ?? "Default";
  const message = errorMessages[errorCode] ?? errorMessages.Default;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="bg-[#1B2A4A] px-8 py-8 text-center">
            <div className="flex justify-center mb-4">
              <BrandLogo variant="white" width={200} />
            </div>
            <p className="text-white/80 text-sm mt-1">Authentication issue</p>
          </div>

          <div className="px-8 py-8 space-y-6">
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Sign-in failed</p>
                <p className="mt-1">{message}</p>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center rounded-xl eq-primary-btn px-4 py-2.5
                         text-sm font-semibold shadow-sm transition
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-[#F5A623]"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
