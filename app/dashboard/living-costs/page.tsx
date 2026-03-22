import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import FinancialRequirementsSettings from "@/app/dashboard/settings/FinancialRequirementsSettings";

export default async function LivingCostsPage() {
  const session = await getServerSession(authOptions);
  const canAccess = session?.user?.roleName === "ADMIN" || session?.user?.roleName === "MANAGER";

  if (!canAccess) {
    redirect("/dashboard");
  }

  return (
    <main className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-bold text-slate-900">Living Costs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage country-level monthly living cost values and visa guidance rules used in finance calculations.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <FinancialRequirementsSettings />
      </section>
    </main>
  );
}
