import Link from "next/link";

export default function StudentChecklistMobileBridgePage({
  searchParams,
}: {
  searchParams: { itemId?: string };
}) {
  void searchParams;
  const target = "/student/documents";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-bold text-slate-900">Mobile Upload Bridge</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open this page on your phone, then use the upload zone to take a photo directly from your camera.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Tip: if you are already on your phone, tap continue below.
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 break-all">
          {target}
        </div>

        <div className="mt-4">
          <Link
            href={target}
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue to Upload
          </Link>
        </div>
      </section>
    </main>
  );
}
