import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ImportClient from "./ImportClient";

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    redirect("/dashboard/leads");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Import Leads from CSV</h1>
      <ImportClient />
    </div>
  );
}
