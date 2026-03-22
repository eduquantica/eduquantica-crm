import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { SubAgentApprovalStatus } from "@prisma/client";
import {
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import ApplicationActions from "./ApplicationActions";

const STATUS_BADGE: Record<SubAgentApprovalStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  INFO_REQUESTED: { label: "Info Requested", className: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

interface PageProps {
  params: { id: string };
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = params;

  const agent = await db.subAgent.findUnique({
    where: { id },
    select: {
      id: true,
      agencyName: true,
      firstName: true,
      lastName: true,
      roleAtAgency: true,
      agencyCountry: true,
      agencyCity: true,
      phone: true,
      website: true,
      expectedMonthlySubmissions: true,
      heardAboutUs: true,
      registrationDocUrl: true,
      approvalStatus: true,
      isApproved: true,
      commissionRate: true,
      approvedAt: true,
      approvedBy: true,
      rejectedAt: true,
      rejectionReason: true,
      revokedAt: true,
      revokeReason: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      infoRequests: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          adminMessage: true,
          adminAttachmentUrl: true,
          agentResponse: true,
          agentAttachmentUrl: true,
          respondedAt: true,
          createdAt: true,
          admin: { select: { name: true } },
        },
      },
      agreement: {
        select: { currentTier: true, currentRate: true, isActive: true },
      },
    },
  });

  if (!agent) notFound();

  const badge = STATUS_BADGE[agent.approvalStatus];
  const fullName =
    agent.firstName && agent.lastName
      ? `${agent.firstName} ${agent.lastName}`
      : agent.user.name ?? "—";

  const docUrl = agent.registrationDocUrl;
  const isExternalDoc = docUrl?.startsWith("http");

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link
        href="/dashboard/sub-agents/applications"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Applications
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{agent.agencyName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
              badge.className,
            )}
          >
            {badge.label}
          </span>
          <ApplicationActions
            id={agent.id}
            status={agent.approvalStatus}
            agentName={fullName}
          />
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Application Details</h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="First Name" value={agent.firstName} />
          <Field label="Last Name" value={agent.lastName} />
          <Field label="Role at Agency" value={agent.roleAtAgency} />
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</p>
              <p className="mt-0.5 text-sm text-slate-800">{agent.user.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Phone</p>
              <p className="mt-0.5 text-sm text-slate-800">{agent.phone ?? agent.user.phone ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Agency</p>
              <p className="mt-0.5 text-sm text-slate-800">{agent.agencyName}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Location</p>
              <p className="mt-0.5 text-sm text-slate-800">
                {[agent.agencyCity, agent.agencyCountry].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </div>
          {agent.website && (
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Website</p>
                <a
                  href={agent.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {agent.website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
          <Field
            label="Expected Monthly Submissions"
            value={agent.expectedMonthlySubmissions}
          />
          <Field label="Heard About Us" value={agent.heardAboutUs} />
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Applied</p>
              <p className="mt-0.5 text-sm text-slate-800">
                {format(new Date(agent.createdAt), "dd MMM yyyy, HH:mm")}
              </p>
            </div>
          </div>
          {agent.approvedAt && (
            <Field
              label="Approved"
              value={format(new Date(agent.approvedAt), "dd MMM yyyy, HH:mm")}
            />
          )}
          {agent.rejectedAt && (
            <>
              <Field
                label="Rejected"
                value={format(new Date(agent.rejectedAt), "dd MMM yyyy, HH:mm")}
              />
              <div className="col-span-2">
                <Field label="Rejection Reason" value={agent.rejectionReason} />
              </div>
            </>
          )}
          {agent.revokedAt && (
            <>
              <Field
                label="Revoked"
                value={format(new Date(agent.revokedAt), "dd MMM yyyy, HH:mm")}
              />
              <div className="col-span-2">
                <Field label="Revoke Reason" value={agent.revokeReason} />
              </div>
            </>
          )}
          {agent.isApproved && agent.agreement && (
            <Field
              label="Commission Rate"
              value={`${agent.agreement.currentRate}% (${agent.agreement.currentTier})`}
            />
          )}
        </div>

        {/* Document download */}
        {docUrl && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">Registration Document</span>
            <div className="ml-auto flex gap-2">
              <a
                href={isExternalDoc ? docUrl : docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview
              </a>
              <a
                href={docUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Info Request Thread */}
      {agent.infoRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">
              Information Request Thread
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {agent.infoRequests.map((req) => (
              <div key={req.id} className="space-y-3">
                {/* Admin message — right aligned */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-blue-50 border border-blue-100 rounded-xl rounded-tr-sm px-4 py-3">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <span className="text-xs font-semibold text-blue-700">
                        {req.admin.name ?? "Admin"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(req.createdAt), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {req.adminMessage}
                    </p>
                    {req.adminAttachmentUrl && (
                      <a
                        href={req.adminAttachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        Attachment
                      </a>
                    )}
                  </div>
                </div>

                {/* Agent response — left aligned */}
                {req.agentResponse ? (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-slate-50 border border-slate-200 rounded-xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center justify-between gap-4 mb-1.5">
                        <span className="text-xs font-semibold text-slate-700">
                          Applicant
                        </span>
                        <span className="text-xs text-slate-400">
                          {req.respondedAt
                            ? format(new Date(req.respondedAt), "dd MMM yyyy, HH:mm")
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {req.agentResponse}
                      </p>
                      {req.agentAttachmentUrl && (
                        <a
                          href={req.agentAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          Attachment
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic pl-2">
                    Awaiting applicant response…
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
