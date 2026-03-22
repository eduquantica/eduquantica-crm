import { MatchStatus } from "@prisma/client";
import { type EligibilityCheckResult } from "@/lib/eligibility/checkEligibility";

export function toMatchStatus(result: EligibilityCheckResult): MatchStatus {
  if (result.message === "Add qualifications to check eligibility") return MatchStatus.PENDING;
  if (result.eligible) return MatchStatus.FULL_MATCH;
  if (result.partiallyEligible) return MatchStatus.PARTIAL_MATCH;
  return MatchStatus.NO_MATCH;
}

export function statusOrder(status: MatchStatus): number {
  if (status === MatchStatus.PENDING) return 0;
  if (status === MatchStatus.FULL_MATCH) return 1;
  if (status === MatchStatus.PARTIAL_MATCH) return 2;
  return 3;
}

export function statusScore(result: EligibilityCheckResult): number {
  if (result.message === "No specific requirements set") return 100;
  if (result.eligible) return 100;
  if (result.partiallyEligible) return 60;
  if (result.message === "Add qualifications to check eligibility") return 0;
  return 20;
}
