import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ApplicationMilestonesManager from "@/components/ApplicationMilestonesManager";

type PageProps = { params: { id: string } };

export default async function StudentApplicationPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  return (
    <div className="min-h-screen student-dashboard-bg">
      <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <section className="glass-card p-6">
          <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Application Details</h1>
          <ApplicationMilestonesManager
            applicationId={params.id}
            roleName={session?.user?.roleName || "STUDENT"}
            portalLabel="student"
          />
        </section>
      </main>
    </div>
  );
}
