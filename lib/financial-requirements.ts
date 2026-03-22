export type FinancialRequirementRule = {
  countryCode: string;
  countryName: string;
  monthlyLivingCost: number;
  currency: string;
  defaultMonths: number;
  rules: string[];
};

export const DEFAULT_FINANCIAL_REQUIREMENTS: FinancialRequirementRule[] = [
  {
    countryCode: "UK",
    countryName: "United Kingdom",
    monthlyLivingCost: 1334,
    currency: "GBP",
    defaultMonths: 9,
    rules: [
      "28-day consecutive bank statement rule",
      "Statement must be dated within 31 days of visa application",
      "9-month living cost maintenance period",
      "Specific language requirement evidence may apply",
    ],
  },
  {
    countryCode: "CA",
    countryName: "Canada",
    monthlyLivingCost: 833,
    currency: "CAD",
    defaultMonths: 12,
    rules: [
      "Bank statements covering last 3 months",
      "CAD 10000 minimum living cost evidence required",
    ],
  },
  {
    countryCode: "AU",
    countryName: "Australia",
    monthlyLivingCost: 1400,
    currency: "AUD",
    defaultMonths: 12,
    rules: [
      "Financial evidence should cover full course duration",
    ],
  },
  {
    countryCode: "US",
    countryName: "United States",
    monthlyLivingCost: 1500,
    currency: "USD",
    defaultMonths: 12,
    rules: [
      "I-20 financial declaration form required",
    ],
  },
  {
    countryCode: "IE",
    countryName: "Ireland",
    monthlyLivingCost: 1000,
    currency: "EUR",
    defaultMonths: 12,
    rules: [
      "Recent bank statement and funds evidence required",
      "Source of funds evidence may be requested",
    ],
  },
  {
    countryCode: "NZ",
    countryName: "New Zealand",
    monthlyLivingCost: 1250,
    currency: "NZD",
    defaultMonths: 12,
    rules: [
      "Evidence of sufficient maintenance funds required",
      "Funds history should support course-duration affordability",
    ],
  },
];

export function normalizeCountryCode(input?: string | null): string {
  const value = (input || "").trim().toUpperCase();
  if (!value) return "";
  if (["UK", "UNITED KINGDOM", "GB", "GREAT BRITAIN"].includes(value)) return "UK";
  if (["CANADA", "CA"].includes(value)) return "CA";
  if (["AUSTRALIA", "AU"].includes(value)) return "AU";
  if (["USA", "US", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(value)) return "US";
  if (["IRELAND", "IE", "REPUBLIC OF IRELAND", "EIRE", "EIRE"].includes(value)) return "IE";
  if (["NEW ZEALAND", "NZ", "AOTEAROA"].includes(value)) return "NZ";
  return value;
}

export function resolveFinancialRequirement(country?: string | null): FinancialRequirementRule {
  const code = normalizeCountryCode(country);
  return (
    DEFAULT_FINANCIAL_REQUIREMENTS.find((row) => row.countryCode === code) ||
    {
      countryCode: code || "OTHER",
      countryName: country || "Other",
      monthlyLivingCost: 1200,
      currency: "USD",
      defaultMonths: 12,
      rules: ["Provide adequate financial evidence for tuition and living costs."],
    }
  );
}

export function parseDurationMonths(duration?: string | null): number {
  if (!duration) return 12;
  const input = duration.toLowerCase();
  const number = Number((input.match(/(\d+(?:\.\d+)?)/) || [""])[1] || 0);
  if (!Number.isFinite(number) || number <= 0) return 12;

  if (input.includes("year")) return Math.max(1, Math.round(number * 12));
  if (input.includes("month")) return Math.max(1, Math.round(number));
  if (input.includes("week")) return Math.max(1, Math.round(number / 4));
  return Math.max(1, Math.round(number));
}
