import AgentApplicationsClient from "./AgentApplicationsClient";

export const metadata = {
  title: "My Applications | Eduquantica CRM",
  description: "Track all applications by stage and status",
};

export default function AgentApplicationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Applications</h1>
        <p className="text-sm text-slate-600">Track all applications by stage and status.</p>
      </div>
      <AgentApplicationsClient />
    </div>
  );
}
