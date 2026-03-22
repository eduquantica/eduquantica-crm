import { ApplicationStatus } from "@prisma/client";

export type PipelineStageKey =
  | "APPLIED"
  | "DOCUMENTS"
  | "SUBMITTED"
  | "OFFER"
  | "FINANCE"
  | "CAS"
  | "VISA"
  | "ENROLLED";

export const PIPELINE_STAGE_LABELS: Record<PipelineStageKey, string> = {
  APPLIED: "Applied",
  DOCUMENTS: "Documents",
  SUBMITTED: "Submitted",
  OFFER: "Offer",
  FINANCE: "Finance",
  CAS: "CAS",
  VISA: "Visa",
  ENROLLED: "Enrolled",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStageKey, string> = {
  APPLIED: "bg-slate-100 text-slate-700",
  DOCUMENTS: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  OFFER: "bg-blue-100 text-blue-700",
  FINANCE: "bg-blue-100 text-blue-700",
  CAS: "bg-blue-100 text-blue-700",
  VISA: "bg-green-100 text-green-700",
  ENROLLED: "bg-emerald-100 text-emerald-700",
};

export const PIPELINE_STAGE_TO_STATUSES: Record<PipelineStageKey, ApplicationStatus[]> = {
  APPLIED: ["APPLIED"],
  DOCUMENTS: ["DOCUMENTS_PENDING", "DOCUMENTS_SUBMITTED"],
  SUBMITTED: ["SUBMITTED_TO_UNIVERSITY"],
  OFFER: ["CONDITIONAL_OFFER", "UNCONDITIONAL_OFFER"],
  FINANCE: ["FINANCE_IN_PROGRESS", "DEPOSIT_PAID", "FINANCE_COMPLETE"],
  CAS: ["CAS_ISSUED"],
  VISA: ["VISA_APPLIED"],
  ENROLLED: ["ENROLLED"],
};

export const IN_PROGRESS_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_SUBMITTED",
  "SUBMITTED_TO_UNIVERSITY",
  "CONDITIONAL_OFFER",
  "UNCONDITIONAL_OFFER",
  "FINANCE_IN_PROGRESS",
  "DEPOSIT_PAID",
  "FINANCE_COMPLETE",
  "CAS_ISSUED",
  "VISA_APPLIED",
];

export function statusToPipelineStage(status: ApplicationStatus): PipelineStageKey {
  for (const [stage, statuses] of Object.entries(PIPELINE_STAGE_TO_STATUSES)) {
    if (statuses.includes(status)) return stage as PipelineStageKey;
  }

  return "APPLIED";
}

export function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}
