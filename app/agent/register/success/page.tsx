import Link from "next/link";

export default function AgentRegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Application Submitted</h1>
        <p className="text-slate-600 mt-3">
          Your application has been submitted. We will review it within 2-3 business days.
        </p>
        <Link href="/login" className="inline-block mt-6 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
