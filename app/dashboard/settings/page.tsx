import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import ChecklistTemplatesEditor from "./ChecklistTemplatesEditor";
import FinancialRequirementsSettings from "./FinancialRequirementsSettings";
import NotificationSettingsCard from "./NotificationSettingsCard";
import ImmigrationMonitorSettings from "./ImmigrationMonitorSettings";
import KpiDefaultSettingsCard from "./KpiDefaultSettingsCard";
import MockInterviewQuestionBankSettings from "./MockInterviewQuestionBankSettings";
import EduviKnowledgeBaseSettings from "./EduviKnowledgeBaseSettings";
import ApplicationFeeManagementSettings from "./ApplicationFeeManagementSettings";
import TestTypesSettingsCard from "./TestTypesSettingsCard";
import PaymentMethodsSettings from "./PaymentMethodsSettings";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function maskValue(value: string) {
  if (!value) return "Not configured";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••${value.slice(-2)}`;
}

export default async function SettingsOverviewPage() {
  const session = await getServerSession(authOptions);
  const canManageEduviKnowledge = session?.user?.roleName === "ADMIN" || session?.user?.roleName === "MANAGER";

  const [users, scanSettings, currencyRates, checklistTemplates] = await Promise.all([
    db.user.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { label: true, name: true } },
      },
    }),
    db.scanSettings.findFirst({
      orderBy: { id: "asc" },
      select: {
        plagiarismGreenMax: true,
        plagiarismAmberMax: true,
        aiGreenMax: true,
        aiAmberMax: true,
        autoApproveGreen: true,
        autoAlertAdmin: true,
      },
    }),
    db.currencyRate.findMany({
      take: 8,
      orderBy: [{ fetchedAt: "desc" }, { baseCurrency: "asc" }, { targetCurrency: "asc" }],
      select: {
        id: true,
        baseCurrency: true,
        targetCurrency: true,
        rate: true,
        source: true,
        fetchedAt: true,
      },
    }),
    db.checklistTemplate.findMany({
      orderBy: [{ countryName: "asc" }, { courseLevel: "asc" }],
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    }),
  ]);

  const latestCurrencyRefresh = currencyRates[0]?.fetchedAt ?? null;
  const companyName = process.env.COMPANY_NAME || "EduQuantica";
  const companyContactEmail = process.env.SMTP_FROM || "noreply@eduquantica.com";
  const companyPhone = process.env.COMPANY_PHONE || "+44 0000 000000";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">1. General Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Company profile used across portal pages and notifications.</p>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Company Name</label>
              <input readOnly value={companyName} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Logo URL</label>
              <input readOnly value="/logo.svg" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Contact Email</label>
                <input readOnly value={companyContactEmail} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Contact Phone</label>
                <input readOnly value={companyPhone} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">2. User Management</h2>
          <p className="mt-1 text-sm text-slate-500">View users, change roles, activate/deactivate and reset passwords (Admin only).</p>
          <div className="mt-4 space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{user.name || user.email}</p>
                    <p className="text-xs text-slate-500">{user.email} • {user.role.label || user.role.name}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            <Link href="/dashboard/settings/users" className="font-medium text-blue-700 hover:underline">Manage Users</Link>
            <Link href="/dashboard/settings/roles" className="font-medium text-blue-700 hover:underline">Manage Roles</Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">3. API and Integrations</h2>
          <p className="mt-1 text-sm text-slate-500">API keys and lead capture webhooks for Facebook and website.</p>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="mb-1 block font-medium text-slate-700">API Key</label>
              <input readOnly value={maskValue(process.env.API_KEY || "")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Facebook Webhook URL</label>
              <input readOnly value="/api/webhooks/facebook" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Website Lead Webhook URL</label>
              <input readOnly value="/api/webhooks/website" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 bg-slate-50" />
            </div>
          </div>
          <div className="mt-4 text-sm">
            <Link href="/dashboard/settings/api" className="font-medium text-blue-700 hover:underline">Open API & Integrations</Link>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">4. Scan Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Copyleaks plagiarism and AI thresholds (Admin only).</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Plagiarism Green Max</p>
              <p className="mt-1 font-semibold text-slate-800">{scanSettings?.plagiarismGreenMax ?? 15}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Plagiarism Amber Max</p>
              <p className="mt-1 font-semibold text-slate-800">{scanSettings?.plagiarismAmberMax ?? 30}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">AI Green Max</p>
              <p className="mt-1 font-semibold text-slate-800">{scanSettings?.aiGreenMax ?? 20}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">AI Amber Max</p>
              <p className="mt-1 font-semibold text-slate-800">{scanSettings?.aiAmberMax ?? 40}%</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Auto-approve green: {scanSettings?.autoApproveGreen ? "Enabled" : "Disabled"} • Auto-alert admin: {scanSettings?.autoAlertAdmin ? "Enabled" : "Disabled"}
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">5. Currency Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Exchange rates, refresh timestamp and manual refresh control.</p>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">Last Refresh</span>
            <span className="font-medium text-slate-800">{formatDate(latestCurrencyRefresh)}</span>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Pair</th>
                  <th className="px-3 py-2 text-left font-medium">Rate</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {currencyRates.map((rate) => (
                  <tr key={rate.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-700">{rate.baseCurrency}/{rate.targetCurrency}</td>
                    <td className="px-3 py-2 text-slate-700">{rate.rate}</td>
                    <td className="px-3 py-2 text-slate-500">{rate.source || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Refresh Now
            </button>
            <span className="text-xs text-slate-500">Manual refresh endpoint: /api/admin/settings/currency/refresh</span>
          </div>
        </section>

        <section id="financial-requirements" className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">6. Financial Requirements</h2>
          <p className="mt-1 text-sm text-slate-500">Living costs and country-specific visa rules.</p>
          <div className="mt-4">
            <FinancialRequirementsSettings />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">7. Notification Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Control portal, email digest, and SMS delivery channels.</p>
          <NotificationSettingsCard />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">8. Checklist Templates</h2>
          <p className="mt-1 text-sm text-slate-500">Document checklist templates by destination country.</p>
          <div className="mt-4">
            <ChecklistTemplatesEditor templates={checklistTemplates} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">10. KPI Targets</h2>
          <p className="mt-1 text-sm text-slate-500">Default KPI targets for all counsellors unless overridden by managers.</p>
          <div className="mt-4">
            <KpiDefaultSettingsCard />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">9. Eduvi Knowledge Base</h2>
          <p className="mt-1 text-sm text-slate-500">Add, edit, preview and activate/deactivate knowledge articles used by Eduvi instantly.</p>
          <div className="mt-4">
            {canManageEduviKnowledge ? <EduviKnowledgeBaseSettings /> : <p className="text-sm text-slate-500">Only Admin and Manager roles can manage Eduvi knowledge base articles.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">10. Immigration Monitor</h2>
          <p className="mt-1 text-sm text-slate-500">Track official government URLs and recent rule-change alerts.</p>
          <div className="mt-4">
            <ImmigrationMonitorSettings roleName={session?.user?.roleName} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">11. Mock Interview Question Bank</h2>
        <p className="mt-1 text-sm text-slate-500">Manage round questions with add, edit, reordering and active/inactive controls.</p>
        <div className="mt-4">
          <MockInterviewQuestionBankSettings />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">12. Application Fee Management</h2>
        <p className="mt-1 text-sm text-slate-500">Configure UCAS annual fees and manage university direct application fees.</p>
        <div className="mt-4">
          <ApplicationFeeManagementSettings />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">13. Test Types</h2>
        <p className="mt-1 text-sm text-slate-500">Manage available test types used in student test score forms.</p>
        <div className="mt-4">
          <TestTypesSettingsCard />
        </div>
      </section>

      <PaymentMethodsSettings />
    </div>
  );
}
