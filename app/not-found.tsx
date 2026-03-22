import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0f1f3b] px-4 py-10">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#f3c96a]/40 bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4a63d]">EduQuantica</p>
        <h1 className="mt-3 text-3xl font-bold text-[#12264a]">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist or may have moved.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-[#d4a63d] px-5 py-2.5 text-sm font-semibold text-[#12264a] hover:bg-[#c7972f]"
        >
          Go back to dashboard
        </Link>
      </div>
    </main>
  );
}
