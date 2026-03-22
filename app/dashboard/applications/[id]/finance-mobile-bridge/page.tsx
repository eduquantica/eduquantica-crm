import Link from "next/link";

export default function ApplicationFinanceMobileBridgePage({ params }: { params: { id: string } }) {
  const target = `/dashboard/applications/${params.id}`;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-bold text-slate-900">Mobile Upload Bridge</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open this page on your phone and continue to the application page to use the camera upload button.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 break-all">
          {target}
        </div>
        <div className="mt-4">
          <Link
            href={target}
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue to Application
          </Link>
        </div>
      </section>
    </main>
  );
}
