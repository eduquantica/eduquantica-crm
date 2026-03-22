import { ApplicationMilestone, ApplicationMilestoneStatus, ApplicationStatus, Prisma } from "@prisma/client";

export const MILESTONE_META: Array<{
  milestone: ApplicationMilestone;
  title: string;
  description: string;
}> = [
  {
    milestone: "APPLICATION_SUBMISSION",
    title: "Application Submission",
    description: "Core submission records and mandatory base documents.",
  },
  {
    milestone: "OFFER_LETTER",
    title: "Offer Letter",
    description: "Offer letter and associated offer conditions.",
  },
  {
    milestone: "FINANCE",
    title: "Finance",
    description: "Financial evidence and deposit-related documents.",
  },
  {
    milestone: "CAS",
    title: "CAS",
    description: "CAS issuance evidence and reference details.",
  },
  {
    milestone: "VISA",
    title: "Visa",
    description: "Visa application and visa decision documentation.",
  },
];

export function milestoneForStatus(status: ApplicationStatus): ApplicationMilestone | null {
  if (status === "APPLIED" || status === "DOCUMENTS_PENDING" || status === "DOCUMENTS_SUBMITTED" || status === "SUBMITTED_TO_UNIVERSITY") {
    return "APPLICATION_SUBMISSION";
  }
  if (status === "CONDITIONAL_OFFER" || status === "UNCONDITIONAL_OFFER") return "OFFER_LETTER";
  if (status === "FINANCE_IN_PROGRESS" || status === "DEPOSIT_PAID" || status === "FINANCE_COMPLETE") return "FINANCE";
  if (status === "CAS_ISSUED") return "CAS";
  if (status === "VISA_APPLIED" || status === "ENROLLED") return "VISA";
  return null;
}

export function requiredMilestonesForStatus(status: ApplicationStatus): ApplicationMilestone[] {
  const ordered: ApplicationMilestone[] = ["APPLICATION_SUBMISSION", "OFFER_LETTER", "FINANCE", "CAS", "VISA"];
  const current = milestoneForStatus(status);
  if (!current) return [];
  return ordered.slice(0, ordered.indexOf(current));
}

export async function ensureApplicationMilestones(tx: Prisma.TransactionClient, applicationId: string) {
  await Promise.all(
    MILESTONE_META.map((row) =>
      tx.applicationMilestoneDocument.upsert({
        where: {
          applicationId_milestone: {
            applicationId,
            milestone: row.milestone,
          },
        },
        update: {
          title: row.title,
          description: row.description,
        },
        create: {
          applicationId,
          milestone: row.milestone,
          title: row.title,
          description: row.description,
          status: "MISSING",
          required: true,
        },
      }),
    ),
  );
}

export function isMilestoneComplete(status: ApplicationMilestoneStatus): boolean {
  return status === "UPLOADED" || status === "VERIFIED";
}
