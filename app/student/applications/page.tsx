"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ShoppingCart } from "lucide-react";

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function ApplicationCard({ application }: { application: ApplicationRow }) {
  const statusMeta = STATUS_UI[application.status];
  const current = stageIndex(application.status);
  const feeUnpaid = application.fee.feeRequired && application.fee.displayStatus === "UNPAID";
  const feePending = application.fee.feeRequired && application.fee.displayStatus === "PENDING_APPROVAL";

  return (
    <article className="glass-card p-5">
      {feeUnpaid && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-amber-800">
            Application fee of <strong>{money(application.fee.amount, application.fee.currency)}</strong> is outstanding.{" "}
            <Link href={`/student/applications/${application.id}/fee?fromCreate=1`} className="font-semibold underline">Pay now</Link>
          </span>
        </div>
      )}
      {feePending && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0" />
          Payment receipt submitted — awaiting approval.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {application.university.logo ? (
            <Image
              src={application.university.logo}
              alt={application.university.name}
              width={56}
              height={56}
              className="h-14 w-14 rounded-xl object-cover"
              loader={({ src }) => src}
              unoptimized
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
              {application.university.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900">{application.university.name}</p>
            <p className="text-sm text-slate-600">{application.course.name}</p>
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <p className="text-xs text-slate-500">Intake: {application.intake?.date || "To be confirmed"}</p>
              {application.applicationRef && (
                <p className="text-xs font-mono text-blue-600">{application.applicationRef}</p>
              )}
            </div>
          </div>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusMeta.badge}`}>
          {statusMeta.label}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-200">Next action: {statusMeta.nextStep}</p>
      {application.status === "VISA_APPLIED" && application.visaSubStatus && (
        <p className="mt-1 text-xs text-slate-600">Visa status: {application.visaSubStatus.replace("VISA_", "")}</p>
      )}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="flex items-center justify-between">
            {STAGES.map((stage, index) => {
              const done = index < current;
              const active = index === current;
              return (
                <div key={`${application.id}-${stage}`} className="flex min-w-0 flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                      done ? "border-blue-600 bg-blue-600 text-white"
                        : active ? "border-blue-600 bg-blue-100 text-blue-700"
                        : "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    }`}>
                      {done ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{stage}</span>
                  </div>
                  {index < STAGES.length - 1 && (
                    <div className={`mx-2 h-1 flex-1 rounded ${index < current ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/student/applications/${application.id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-white/20 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
        >
          View Full Details
        </Link>
        {feeUnpaid && (
          <Link
            href={`/student/applications/${application.id}/fee?fromCreate=1`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Pay Application Fee
          </Link>
        )}
      </div>
    </article>
  );
}

function ApplicationsList({ applications }: { applications: ApplicationRow[] }) {
  const unpaidFee = applications.filter(
    (a) => a.fee.feeRequired && a.fee.displayStatus === "UNPAID" && a.status !== "WITHDRAWN",
  );
  const active = applications.filter(
    (a) => !(a.fee.feeRequired && a.fee.displayStatus === "UNPAID" && a.status !== "WITHDRAWN"),
  );

  return (
    <div className="space-y-6">
      {unpaidFee.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2 rounded-t-xl bg-amber-600 px-4 py-2.5">
            <ShoppingCart className="h-4 w-4 text-white" />
            <h2 className="text-sm font-semibold text-white">Unpaid Application Fee ({unpaidFee.length})</h2>
          </div>
          <div className="space-y-3">
            {unpaidFee.map((app) => <ApplicationCard key={app.id} application={app} />)}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          {unpaidFee.length > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-t-xl bg-blue-600 px-4 py-2.5">
              <Check className="h-4 w-4 text-white" />
              <h2 className="text-sm font-semibold text-white">Active Applications ({active.length})</h2>
            </div>
          )}
          <div className="space-y-3">
            {active.map((app) => <ApplicationCard key={app.id} application={app} />)}
          </div>
        </section>
      )}
    </div>
  );
}

type AppStatus =
  | "APPLIED"
  | "DOCUMENTS_PENDING"
  | "DOCUMENTS_SUBMITTED"
  | "SUBMITTED_TO_UNIVERSITY"
  | "CONDITIONAL_OFFER"
  | "UNCONDITIONAL_OFFER"
  | "FINANCE_IN_PROGRESS"
  | "DEPOSIT_PAID"
  | "FINANCE_COMPLETE"
  | "CAS_ISSUED"
  | "VISA_APPLIED"
  | "ENROLLED"
  | "WITHDRAWN";

type FeeStatus = "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";

type ApplicationRow = {
  id: string;
  applicationRef?: string | null;
  status: AppStatus;
  visaSubStatus?: "VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED" | null;
  createdAt: string;
  submittedAt: string | null;
  offerReceivedAt: string | null;
  intake: { date?: string; deadline?: string } | null;
  fee: { feeRequired: boolean; displayStatus: FeeStatus; amount: number; currency: string };
  course: { id: string; name: string };
  university: {
    id: string;
    name: string;
    logo: string | null;
    country: string;
  };
};

const STATUS_UI: Record<AppStatus, { label: string; badge: string; nextStep: string }> = {
  APPLIED: { label: "Application Submitted", badge: "bg-slate-100 text-slate-700", nextStep: "Your counsellor will review your application shortly." },
  DOCUMENTS_PENDING: { label: "Documents Pending", badge: "bg-amber-100 text-amber-700", nextStep: "Upload your documents" },
  DOCUMENTS_SUBMITTED: { label: "Documents Verified", badge: "bg-blue-100 text-blue-700", nextStep: "Your counsellor will submit your application to the university." },
  SUBMITTED_TO_UNIVERSITY: { label: "Submitted to University", badge: "bg-indigo-100 text-indigo-700", nextStep: "Waiting for university decision" },
  CONDITIONAL_OFFER: { label: "Conditional Offer", badge: "bg-yellow-100 text-yellow-700", nextStep: "Complete your offer conditions" },
  UNCONDITIONAL_OFFER: { label: "Unconditional Offer", badge: "bg-emerald-100 text-emerald-700", nextStep: "Pay deposit and complete finance" },
  FINANCE_IN_PROGRESS: { label: "Finance Started", badge: "bg-cyan-100 text-cyan-700", nextStep: "Complete your financial documents" },
  DEPOSIT_PAID: { label: "Deposit Confirmed", badge: "bg-teal-100 text-teal-700", nextStep: "Complete remaining finance documents" },
  FINANCE_COMPLETE: { label: "Finance Complete", badge: "bg-green-100 text-green-700", nextStep: "Waiting for your CAS letter" },
  CAS_ISSUED: { label: "CAS Issued", badge: "bg-indigo-100 text-indigo-700", nextStep: "Start your visa application" },
  VISA_APPLIED: { label: "Visa Applied", badge: "bg-purple-100 text-purple-700", nextStep: "Wait for visa decision" },
  ENROLLED: { label: "Enrolled", badge: "bg-teal-100 text-teal-700", nextStep: "Welcome to your program" },
  WITHDRAWN: { label: "Withdrawn", badge: "bg-slate-100 text-slate-700", nextStep: "Explore new course options" },
};

const STAGES = [
  "Application Submitted",
  "Documents Requested",
  "Documents Verified",
  "Submitted to University",
  "Offer Received",
  "Unconditional Offer",
  "Finance Started",
  "Deposit Confirmed",
  "Finance Complete",
  "CAS Issued",
  "Visa Applied",
  "Enrolled",
  "Withdrawn",
] as const;

function stageIndex(status: AppStatus) {
  if (status === "WITHDRAWN") return 12;
  if (status === "ENROLLED") return 11;
  if (status === "VISA_APPLIED") return 10;
  if (status === "CAS_ISSUED") return 9;
  if (status === "FINANCE_COMPLETE") return 8;
  if (status === "DEPOSIT_PAID") return 7;
  if (status === "FINANCE_IN_PROGRESS") return 6;
  if (status === "UNCONDITIONAL_OFFER") return 5;
  if (status === "CONDITIONAL_OFFER") return 4;
  if (status === "SUBMITTED_TO_UNIVERSITY") return 3;
  if (status === "DOCUMENTS_SUBMITTED") return 2;
  if (status === "DOCUMENTS_PENDING") return 1;
  return 0;
}

export default function StudentApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/student/applications", { cache: "no-store" });
        const json = await res.json() as { data?: ApplicationRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load applications");
        if (mounted) {
          setApplications(json.data || []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load applications");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const emptyState = useMemo(() => !loading && !error && applications.length === 0, [loading, error, applications.length]);

  return (
    <div className="min-h-screen student-dashboard-bg">
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="glass-card p-6">
        <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Track every stage of your applications in one place.</p>
      </section>

      {loading && <div className="glass-card p-6 text-sm text-slate-600 dark:text-slate-300">Loading applications...</div>}
      {error && <div className="rounded-xl border border-rose-200/80 bg-rose-50/90 dark:border-rose-400/30 dark:bg-rose-900/30 p-6 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {emptyState && (
        <section className="glass-card p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">No applications yet</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Start exploring courses to create your first application.</p>
          <Link
            href="/student/courses"
            className="mt-5 inline-flex items-center gap-2 gradient-btn rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Start Exploring Courses <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      {!loading && !error && applications.length > 0 && (
        <ApplicationsList applications={applications} />
      )}
    </main>
    </div>
  );
}
