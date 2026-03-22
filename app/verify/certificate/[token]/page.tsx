import Link from "next/link";
import { db } from "@/lib/db";

export default async function PublicCertificateVerificationPage({
  params,
}: {
  params: { token: string };
}) {
  const certificate = await db.verifiedCertificate.findUnique({
    where: { publicToken: params.token },
    select: {
      reference: true,
      studentName: true,
      universityName: true,
      courseName: true,
      destinationCountry: true,
      issuedAt: true,
      pdfUrl: true,
    },
  });

  if (!certificate) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Certificate Not Found</h1>
          <p className="mt-2 text-sm text-red-700">The verification link is invalid or has expired.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Verified Certificate</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{certificate.reference}</h1>

        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd className="font-medium text-slate-900">{certificate.studentName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">University</dt>
            <dd className="font-medium text-slate-900">{certificate.universityName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Course</dt>
            <dd className="font-medium text-slate-900">{certificate.courseName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Destination Country</dt>
            <dd className="font-medium text-slate-900">{certificate.destinationCountry || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Issued On</dt>
            <dd className="font-medium text-slate-900">{new Date(certificate.issuedAt).toLocaleDateString("en-GB")}</dd>
          </div>
        </dl>

        {certificate.pdfUrl && (
          <div className="mt-6">
            <Link href={certificate.pdfUrl} className="text-sm font-semibold text-blue-600 hover:underline">
              Download Certificate PDF
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
