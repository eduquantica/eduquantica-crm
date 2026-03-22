import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AgentApplicationFinanceMobileBridgePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.roleName !== "SUB_AGENT") {
    return <div className="p-6 text-sm text-red-600">Unauthorized</div>;
  }

  const application = await db.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      studentId: true,
      student: {
        select: {
          subAgent: { select: { userId: true } },
        },
      },
    },
  });

  if (!application || application.student.subAgent?.userId !== session.user.id) {
    return <div className="p-6 text-sm text-red-600">Application not found</div>;
  }

  const target = `/agent/students/${application.studentId}?tab=finance&applicationId=${application.id}`;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-bold text-slate-900">Mobile Upload Bridge</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open this page on your phone and continue to the student finance tab to take photos and upload financial documents.
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 break-all">
          {target}
        </div>

        <div className="mt-4">
          <Link
            href={target}
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue to Student Page
          </Link>
        </div>
      </section>
    </main>
  );
}
