/**
 * Lead scoring function
 * Calculates a lead score from 0-100 based on various criteria
 */

interface LeadForScoring {
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  campaign?: string | null;
  interestedLevel?: string | null;
  assignedCounsellorId?: string | null;
  status?: string;
  communicationCount?: number;
}

export function calculateLeadScore(lead: LeadForScoring): number {
  let score = 0;

  // +20 points: lead has an email address
  if (lead.email) score += 20;

  // +10 points: lead has a phone number
  if (lead.phone) score += 10;

  // +10 points: lead has nationality set
  if (lead.nationality) score += 10;

  // +10 points: lead has preferred destination set
  if (lead.campaign) score += 10;

  // +10 points: lead has interested in (study level) set
  if (lead.interestedLevel) score += 10;

  // +10 points: lead has assigned counsellor
  if (lead.assignedCounsellorId) score += 10;

  // Status-based points
  if (lead.status === "CONTACTED") {
    score += 10;
  } else if (lead.status === "QUALIFIED") {
    score += 20;
  } else if (lead.status === "CONVERTED") {
    score += 30;
  }

  // +10 points: lead has at least one note or call log
  if (lead.communicationCount && lead.communicationCount > 0) {
    score += 10;
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Get the color class for a lead score
 * 70-100: green
 * 40-69: amber
 * 0-39: red
 */
export function getScoreColorClass(score: number): string {
  if (score >= 70) {
    return "bg-green-100 text-green-700 border-green-300";
  } else if (score >= 40) {
    return "bg-amber-100 text-amber-700 border-amber-300";
  } else {
    return "bg-red-100 text-red-700 border-red-300";
  }
}

/**
 * Get the color for the circular progress ring
 */
export function getScoreRingColor(score: number): { bg: string; ring: string } {
  if (score >= 70) {
    return { bg: "from-green-400 to-green-600", ring: "text-green-600" };
  } else if (score >= 40) {
    return { bg: "from-amber-400 to-amber-600", ring: "text-amber-600" };
  } else {
    return { bg: "from-red-400 to-red-600", ring: "text-red-600" };
  }
}
