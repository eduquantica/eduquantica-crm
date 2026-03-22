import type { ApplicationStatus, VisaSubStatus } from "@prisma/client";

export const APPLICATION_PIPELINE: ApplicationStatus[] = [
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
  "ENROLLED",
  "WITHDRAWN",
];

export const VISA_SUB_STATUS_OPTIONS: VisaSubStatus[] = [
  "VISA_PENDING",
  "VISA_APPROVED",
  "VISA_REJECTED",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Application Submitted",
  DOCUMENTS_PENDING: "Documents Requested",
  DOCUMENTS_SUBMITTED: "Documents Verified",
  SUBMITTED_TO_UNIVERSITY: "Submitted to University",
  CONDITIONAL_OFFER: "Conditional Offer",
  UNCONDITIONAL_OFFER: "Unconditional Offer",
  FINANCE_IN_PROGRESS: "Finance In Progress",
  DEPOSIT_PAID: "Deposit Paid",
  FINANCE_COMPLETE: "Finance Complete",
  CAS_ISSUED: "CAS Issued",
  VISA_APPLIED: "Visa Applied",
  ENROLLED: "Enrolled",
  WITHDRAWN: "Withdrawn",
};

export const APPLICATION_STATUS_BADGES: Record<ApplicationStatus, string> = {
  APPLIED: "bg-slate-100 text-slate-700",
  DOCUMENTS_PENDING: "bg-amber-100 text-amber-700",
  DOCUMENTS_SUBMITTED: "bg-blue-100 text-blue-700",
  SUBMITTED_TO_UNIVERSITY: "bg-indigo-100 text-indigo-700",
  CONDITIONAL_OFFER: "bg-yellow-100 text-yellow-800",
  UNCONDITIONAL_OFFER: "bg-emerald-100 text-emerald-700",
  FINANCE_IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  DEPOSIT_PAID: "bg-teal-100 text-teal-700",
  FINANCE_COMPLETE: "bg-green-100 text-green-700",
  CAS_ISSUED: "bg-violet-100 text-violet-700",
  VISA_APPLIED: "bg-orange-100 text-orange-700",
  ENROLLED: "bg-emerald-200 text-emerald-800",
  WITHDRAWN: "bg-slate-200 text-slate-700",
};

export const VISA_SUB_STATUS_LABELS: Record<VisaSubStatus, string> = {
  VISA_PENDING: "Pending",
  VISA_APPROVED: "Approved",
  VISA_REJECTED: "Rejected",
};

export const VISA_SUB_STATUS_BADGES: Record<VisaSubStatus, string> = {
  VISA_PENDING: "bg-blue-100 text-blue-700",
  VISA_APPROVED: "bg-emerald-100 text-emerald-700",
  VISA_REJECTED: "bg-red-100 text-red-700",
};

export const COUNSELLOR_ALLOWED_STATUSES: ApplicationStatus[] = [
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

export const SUB_AGENT_ALLOWED_STATUSES: ApplicationStatus[] = [
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

export function statusIndex(status: ApplicationStatus): number {
  return APPLICATION_PIPELINE.indexOf(status);
}

export function isLaterOrEqualStatus(status: ApplicationStatus, target: ApplicationStatus): boolean {
  return statusIndex(status) >= statusIndex(target);
}

export function requiresNotes(status: ApplicationStatus, visaSubStatus?: VisaSubStatus | null): boolean {
  return (
    status === "CONDITIONAL_OFFER"
    || status === "UNCONDITIONAL_OFFER"
    || status === "WITHDRAWN"
    || visaSubStatus === "VISA_REJECTED"
  );
}

export function stageExplanation(status: ApplicationStatus, visaSubStatus?: VisaSubStatus | null): string {
  if (status === "APPLIED") return "Your counsellor will review your application shortly.";
  if (status === "DOCUMENTS_PENDING") return "Please upload your required documents from the Documents tab.";
  if (status === "DOCUMENTS_SUBMITTED") return "Your documents are verified. Your counsellor will submit your application to the university.";
  if (status === "SUBMITTED_TO_UNIVERSITY") return "Your application is with the university. We are waiting for their decision.";
  if (status === "CONDITIONAL_OFFER") return "You have a conditional offer! Review the conditions in the Offer Letter tab.";
  if (status === "UNCONDITIONAL_OFFER") return "Excellent! You have an unconditional offer. Please complete your finance section.";
  if (status === "FINANCE_IN_PROGRESS") return "Please complete your financial documents in the Finance tab.";
  if (status === "DEPOSIT_PAID") return "Your deposit is confirmed. Please complete your remaining financial documents.";
  if (status === "FINANCE_COMPLETE") return "All financial documents complete. Waiting for your CAS letter.";
  if (status === "CAS_ISSUED") return "Your CAS letter is ready. Your counsellor will help you apply for your visa.";
  if (status === "VISA_APPLIED" && visaSubStatus === "VISA_APPROVED") return "Your visa has been approved! Get ready for university.";
  if (status === "VISA_APPLIED" && visaSubStatus === "VISA_REJECTED") return "Unfortunately your visa was refused. Please contact your counsellor immediately.";
  if (status === "VISA_APPLIED") return "Your visa application has been submitted. Waiting for a decision.";
  if (status === "ENROLLED") return "Congratulations! You are now enrolled. Your EduQuantica journey is complete!";
  return "This application has been withdrawn.";
}

export function toStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
