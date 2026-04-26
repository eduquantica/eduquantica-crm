import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getApplicationFeeSummary } from "@/lib/application-fees";
import ApplicationMilestonesManager from "@/components/ApplicationMilestonesManager";

type PageProps = { params: { id: string } };

export default async function StudentApplicationPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  const feeSummary = await getApplicationFeeSummary(params.id).catch(() => null);
  const application = await db.application.findUnique({
    where: { id: params.id },
    select: { applicationRef: true },
  }).catch(() => null);

  const showFeeBanner = feeSummary?.feeRequired && feeSummary.displayStatus === "UNPAID";

  return (
    <div className="w-full px-5 py-6 sm:px-7 space-y-4">
      {showFeeBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <span className="text-amber-500">⚠</span>
            <span>
              Application fee of{" "}
              <strong>
                {new Intl.NumberFormat("en-GB", { style: "currency", currency: feeSummary.currency }).format(feeSummary.amount)}
              </strong>{" "}
              is outstanding. Pay to keep your application active.
            </span>
          </div>
          <Link
            href={`/student/applications/${params.id}/fee?fromCreate=1`}
            className="shrink-0 rounded-xl px-4 py-1.5 text-sm font-bold text-[#1B2A4A] hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #F5A623, #e8930f)" }}
          >
            Pay Now
          </Link>
        </div>
      )}

      <section className="glass-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-[#1B2A4A]">Application Details</h1>
          {application?.applicationRef && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-mono text-amber-700">
              {application.applicationRef}
            </span>
          )}
        </div>
        <ApplicationMilestonesManager
          applicationId={params.id}
          roleName={session?.user?.roleName || "STUDENT"}
          portalLabel="student"
        />
      </section>
    </div>
  );
}
