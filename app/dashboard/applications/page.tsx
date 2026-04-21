import { Suspense } from "react";
import ApplicationsClient from "./ApplicationsClient";

export const metadata = {
  title: "Applications | Eduquantica CRM",
  description: "Manage student applications",
};

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center p-8 text-slate-500">Loading applications…</div>}>
      <ApplicationsClient />
    </Suspense>
  );
}
