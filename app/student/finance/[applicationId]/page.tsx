import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ApplicationFinanceTab from "@/app/dashboard/applications/[id]/ApplicationFinanceTab";

export default async function StudentFinanceDetailPage({ params }: { params: { applicationId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    return <div className="p-6 text-sm text-red-600">Unauthorized</div>;
  }

  const application = await db.application.findUnique({
    where: { id: params.applicationId },
    include: {
      student: {
        select: {
          userId: true,
          nationality: true,
        },
      },
    },
  });

  if (!application || application.student.userId !== session.user.id) {
    return <div className="p-6 text-sm text-red-600">Application not found</div>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Application Finance</h1>
            <p className="mt-1 text-sm text-slate-500">Complete your finance declaration and required financial documents.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/student/finance"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Finance Overview
            </Link>
            <Link
              href="/student/documents"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Documents
            </Link>
          </div>
        </div>
      </div>

      <ApplicationFinanceTab
        applicationId={application.id}
        userRole="STUDENT"
        studentNationality={application.student.nationality}
      />
    </main>
  );
}
