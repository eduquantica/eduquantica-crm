import { normalizeCountryCode } from "@/lib/financial-requirements";

export type BankStatementOutcome = "GREEN" | "AMBER" | "RED";

export type BankStatementExtracted = {
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  statementDate: string | null;
  closingBalance: number | null;
  openingBalance: number | null;
  currency: string | null;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
};

export type BankStatementChecks = {
  nameMatch: {
    passed: boolean;
    distance: number;
    extractedName: string;
    expectedName: string;
  };
  statementDateWindow: {
    passed: boolean;
    rule: string;
    details: string;
  };
  balanceSufficiency: {
    passed: boolean;
    closingBalance: number | null;
    requiredAmount: number;
    shortfall: number;
  };
  uk28DayRule: {
    status: "PASS" | "FAIL" | "CANNOT_CONFIRM" | "NOT_APPLICABLE";
    details: string;
    minBalanceInWindow: number | null;
    firstRequiredDate: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    currentDayCount: number;
    remainingDays: number;
    droppedBelowDate: string | null;
    droppedBelowAmount: number | null;
  };
};

type VerifyArgs = {
  extracted: BankStatementExtracted;
  studentFullName: string;
  destinationCountry: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  totalToShowInBank: number;
  durationMonths: number;
};

function levenshteinDistance(a: string, b: string): number {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (left === right) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= right.length; i += 1) matrix[i] = [i];
  for (let j = 0; j <= left.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= right.length; i += 1) {
    for (let j = 1; j <= left.length; j += 1) {
      if (right.charAt(i - 1) === left.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[right.length][left.length];
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatISODate(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function dateDiffDays(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000));
}

function classifySignedAmount(description: string, amount: number): number {
  const text = (description || "").toLowerCase();
  const debitHints = ["withdraw", "debit", "atm", "payment", "charge", "fee", "dr", "transfer out"];
  const creditHints = ["deposit", "credit", "salary", "received", "refund", "cr", "transfer in"];

  if (debitHints.some((hint) => text.includes(hint))) return -Math.abs(amount);
  if (creditHints.some((hint) => text.includes(hint))) return Math.abs(amount);
  return amount;
}

function evaluateUk28DayRule(args: {
  statementDate: Date | null;
  openingBalance: number | null;
  transactions: Array<{ date: string; description: string; amount: number }>;
  requiredAmount: number;
}): BankStatementChecks["uk28DayRule"] {
  const { statementDate, openingBalance, transactions, requiredAmount } = args;

  if (!statementDate) {
    return {
      status: "CANNOT_CONFIRM",
      details: "Statement date missing.",
      minBalanceInWindow: null,
      firstRequiredDate: null,
      windowStart: null,
      windowEnd: null,
      currentDayCount: 0,
      remainingDays: 28,
      droppedBelowDate: null,
      droppedBelowAmount: null,
    };
  }

  if (openingBalance == null) {
    return {
      status: "CANNOT_CONFIRM",
      details: "Opening balance missing.",
      minBalanceInWindow: null,
      firstRequiredDate: null,
      windowStart: formatISODate(new Date(statementDate.getTime() - 27 * 24 * 60 * 60 * 1000)),
      windowEnd: formatISODate(statementDate),
      currentDayCount: 0,
      remainingDays: 28,
      droppedBelowDate: null,
      droppedBelowAmount: null,
    };
  }

  const datedTx = transactions
    .map((item) => ({
      ...item,
      parsedDate: parseDate(item.date),
      signedAmount: classifySignedAmount(item.description, item.amount),
    }))
    .filter((item) => item.parsedDate)
    .sort((left, right) => left.parsedDate!.getTime() - right.parsedDate!.getTime());

  if (!datedTx.length) {
    return {
      status: "CANNOT_CONFIRM",
      details: "No dated transactions extracted.",
      minBalanceInWindow: null,
      firstRequiredDate: null,
      windowStart: formatISODate(new Date(statementDate.getTime() - 27 * 24 * 60 * 60 * 1000)),
      windowEnd: formatISODate(statementDate),
      currentDayCount: 0,
      remainingDays: 28,
      droppedBelowDate: null,
      droppedBelowAmount: null,
    };
  }

  const deltaByDay = new Map<string, number>();
  for (const tx of datedTx) {
    const key = tx.parsedDate!.toISOString().slice(0, 10);
    deltaByDay.set(key, (deltaByDay.get(key) || 0) + tx.signedAmount);
  }

  let runningBalance = openingBalance;
  const endDate = new Date(statementDate);
  const startDate = new Date(datedTx[0].parsedDate!);
  const balanceByDay = new Map<string, number>();

  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    runningBalance += deltaByDay.get(key) || 0;
    balanceByDay.set(key, runningBalance);
  }

  let firstRequiredDate: Date | null = null;
  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    const value = balanceByDay.get(key);
    if (typeof value === "number" && value >= requiredAmount) {
      firstRequiredDate = new Date(cursor);
      break;
    }
  }

  if (!firstRequiredDate) {
    return {
      status: "FAIL",
      details: `❌ 28-day rule FAILED\nBalance never reached the required amount of ${requiredAmount.toLocaleString()} in this statement period. Please provide a new statement showing 28 consecutive days above the required amount.`,
      minBalanceInWindow: null,
      firstRequiredDate: null,
      windowStart: null,
      windowEnd: null,
      currentDayCount: 0,
      remainingDays: 28,
      droppedBelowDate: null,
      droppedBelowAmount: null,
    };
  }

  const requiredWindowEnd = new Date(firstRequiredDate);
  requiredWindowEnd.setDate(requiredWindowEnd.getDate() + 27);

  const currentDayCount = Math.max(1, dateDiffDays(endDate, firstRequiredDate) + 1);
  if (requiredWindowEnd.getTime() > endDate.getTime()) {
    const remainingDays = Math.max(0, 28 - currentDayCount);
    return {
      status: "CANNOT_CONFIRM",
      details: `⏳ 28-day period in progress\nRequired amount present since ${formatISODate(firstRequiredDate)}.\n${currentDayCount} days completed, ${remainingDays} days remaining.\nPlease upload a new statement after ${formatISODate(requiredWindowEnd)}.`,
      minBalanceInWindow: null,
      firstRequiredDate: formatISODate(firstRequiredDate),
      windowStart: formatISODate(firstRequiredDate),
      windowEnd: formatISODate(requiredWindowEnd),
      currentDayCount,
      remainingDays,
      droppedBelowDate: null,
      droppedBelowAmount: null,
    };
  }

  let minBalance: number | null = null;
  for (let cursor = new Date(firstRequiredDate); cursor <= requiredWindowEnd; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    const value = balanceByDay.get(key);
    if (typeof value !== "number") {
      return {
        status: "CANNOT_CONFIRM",
        details: "Daily balance coverage is incomplete in the required 28-day period.",
        minBalanceInWindow: null,
        firstRequiredDate: formatISODate(firstRequiredDate),
        windowStart: formatISODate(firstRequiredDate),
        windowEnd: formatISODate(requiredWindowEnd),
        currentDayCount,
        remainingDays: 0,
        droppedBelowDate: null,
        droppedBelowAmount: null,
      };
    }
    minBalance = minBalance === null ? value : Math.min(minBalance, value);
    if (value < requiredAmount) {
      return {
        status: "FAIL",
        details: `❌ 28-day rule FAILED\nBalance dropped below ${requiredAmount.toLocaleString()} on ${key}.\nThe amount dropped to ${value.toLocaleString()}.\nPlease provide a new statement showing 28 consecutive days above ${requiredAmount.toLocaleString()}.`,
        minBalanceInWindow: minBalance,
        firstRequiredDate: formatISODate(firstRequiredDate),
        windowStart: formatISODate(firstRequiredDate),
        windowEnd: formatISODate(requiredWindowEnd),
        currentDayCount: Math.max(1, dateDiffDays(new Date(key), firstRequiredDate) + 1),
        remainingDays: 0,
        droppedBelowDate: key,
        droppedBelowAmount: value,
      };
    }
  }

  return {
    status: "PASS",
    details: `✅ 28-day rule CONFIRMED\n${Math.round(requiredAmount).toLocaleString()} held continuously from ${formatISODate(firstRequiredDate)} to ${formatISODate(requiredWindowEnd)} - 28 days.\nThis bank account meets UK visa requirements.`,
    minBalanceInWindow: minBalance,
    firstRequiredDate: formatISODate(firstRequiredDate),
    windowStart: formatISODate(firstRequiredDate),
    windowEnd: formatISODate(requiredWindowEnd),
    currentDayCount: 28,
    remainingDays: 0,
    droppedBelowDate: null,
    droppedBelowAmount: null,
  };
}

export function verifyBankStatement(args: VerifyArgs): {
  checks: BankStatementChecks;
  outcome: BankStatementOutcome;
  message: string;
} {
  const {
    extracted,
    studentFullName,
    destinationCountry,
    submittedAt,
    createdAt,
    totalToShowInBank,
    durationMonths,
  } = args;

  const countryCode = normalizeCountryCode(destinationCountry);
  const statementDate = parseDate(extracted.statementDate);

  const nameDistance = levenshteinDistance(extracted.accountHolderName || "", studentFullName || "");
  const nameMatchPassed = nameDistance <= 2;

  const submissionAnchor = submittedAt || createdAt;
  let statementDateWindowPassed = false;
  let dateRule = "General date validity";
  let dateDetails = "Unable to validate date rule.";

  if (countryCode === "UK") {
    dateRule = "Statement must be within 31 days of application submission";
    if (statementDate) {
      const days = dateDiffDays(submissionAnchor, statementDate);
      statementDateWindowPassed = days >= 0 && days <= 31;
      dateDetails = statementDateWindowPassed
        ? `Statement is ${days} days before submission.`
        : `Statement is outside 31-day UK window (${days} days).`;
    } else {
      dateDetails = "Statement date missing.";
    }
  } else if (countryCode === "CA") {
    dateRule = "Statement should cover at least last 3 months";
    const txDates = extracted.transactions
      .map((row) => parseDate(row.date))
      .filter((row): row is Date => Boolean(row))
      .sort((left, right) => left.getTime() - right.getTime());

    if (statementDate && txDates.length) {
      const coverageDays = dateDiffDays(statementDate, txDates[0]);
      statementDateWindowPassed = coverageDays >= 90;
      dateDetails = statementDateWindowPassed
        ? `Transaction coverage is ${coverageDays} days.`
        : `Transaction coverage is ${coverageDays} days; minimum 90 days required.`;
    } else {
      dateDetails = "Cannot confirm 3-month coverage from extracted transactions.";
    }
  } else if (countryCode === "AU") {
    dateRule = "Statement should evidence funds over course duration";
    const txDates = extracted.transactions
      .map((row) => parseDate(row.date))
      .filter((row): row is Date => Boolean(row))
      .sort((left, right) => left.getTime() - right.getTime());

    if (statementDate && txDates.length) {
      const coverageDays = dateDiffDays(statementDate, txDates[0]);
      const requiredDays = Math.max(30, durationMonths * 30);
      statementDateWindowPassed = coverageDays >= requiredDays;
      dateDetails = statementDateWindowPassed
        ? `Transaction coverage is ${coverageDays} days for a ${durationMonths}-month course.`
        : `Coverage is ${coverageDays} days; expected about ${requiredDays} days for course-duration evidence.`;
    } else {
      dateDetails = "Cannot confirm course-duration coverage from extracted transactions.";
    }
  } else if (countryCode === "US") {
    dateRule = "Statement should be within 120 days of submission";
    if (statementDate) {
      const days = dateDiffDays(submissionAnchor, statementDate);
      statementDateWindowPassed = days >= 0 && days <= 120;
      dateDetails = statementDateWindowPassed
        ? `Statement is ${days} days before submission.`
        : `Statement is outside 120-day US window (${days} days).`;
    } else {
      dateDetails = "Statement date missing.";
    }
  } else if (countryCode === "IE") {
    dateRule = "Statement should be within 31 days of submission";
    if (statementDate) {
      const days = dateDiffDays(submissionAnchor, statementDate);
      statementDateWindowPassed = days >= 0 && days <= 31;
      dateDetails = statementDateWindowPassed
        ? `Statement is ${days} days before submission.`
        : `Statement is outside 31-day Ireland window (${days} days).`;
    } else {
      dateDetails = "Statement date missing.";
    }
  } else if (countryCode === "NZ") {
    dateRule = "Statement should be within 31 days of submission";
    if (statementDate) {
      const days = dateDiffDays(submissionAnchor, statementDate);
      statementDateWindowPassed = days >= 0 && days <= 31;
      dateDetails = statementDateWindowPassed
        ? `Statement is ${days} days before submission.`
        : `Statement is outside 31-day New Zealand window (${days} days).`;
    } else {
      dateDetails = "Statement date missing.";
    }
  } else {
    statementDateWindowPassed = Boolean(statementDate);
    dateDetails = statementDateWindowPassed ? "Statement date found." : "Statement date missing.";
  }

  const closingBalance = extracted.closingBalance ?? null;
  const balancePassed = closingBalance !== null && closingBalance >= totalToShowInBank;
  const shortfall = Math.max(totalToShowInBank - (closingBalance || 0), 0);

  const ukRule = countryCode === "UK"
    ? evaluateUk28DayRule({
        statementDate,
        openingBalance: extracted.openingBalance,
        transactions: extracted.transactions,
        requiredAmount: totalToShowInBank,
      })
    : {
        status: "NOT_APPLICABLE" as const,
        details: "28-day rule applies to UK only.",
        minBalanceInWindow: null,
        firstRequiredDate: null,
        windowStart: null,
        windowEnd: null,
        currentDayCount: 0,
        remainingDays: 0,
        droppedBelowDate: null,
        droppedBelowAmount: null,
      };

  const checks: BankStatementChecks = {
    nameMatch: {
      passed: nameMatchPassed,
      distance: nameDistance,
      extractedName: extracted.accountHolderName,
      expectedName: studentFullName,
    },
    statementDateWindow: {
      passed: statementDateWindowPassed,
      rule: dateRule,
      details: dateDetails,
    },
    balanceSufficiency: {
      passed: balancePassed,
      closingBalance,
      requiredAmount: totalToShowInBank,
      shortfall,
    },
    uk28DayRule: ukRule,
  };

  if (!balancePassed) {
    const outcome: BankStatementOutcome = "RED";
    const message = `Balance ${(closingBalance || 0).toLocaleString()} is below the required ${totalToShowInBank.toLocaleString()}. You need an additional ${shortfall.toLocaleString()} to meet requirements.`;
    return { checks, outcome, message };
  }

  const hasNonUkCriticalFailure = !nameMatchPassed || !statementDateWindowPassed || (countryCode === "UK" && ukRule.status === "FAIL");
  if (hasNonUkCriticalFailure) {
    const outcome: BankStatementOutcome = "RED";
    const message = !nameMatchPassed
      ? "Account holder name does not sufficiently match student record."
      : !statementDateWindowPassed
        ? `Statement date check failed: ${dateDetails}`
        : ukRule.details;
    return { checks, outcome, message };
  }

  if (countryCode === "UK" && ukRule.status === "CANNOT_CONFIRM") {
    const outcome: BankStatementOutcome = "AMBER";
    const message = ukRule.details;
    return { checks, outcome, message };
  }

  const outcome: BankStatementOutcome = "GREEN";
  const heldText = countryCode === "UK" ? "held for 28+ days" : "funds verified";
  const message = `Meets ${countryCode || "destination"} requirements. ${Math.round(totalToShowInBank).toLocaleString()} ${heldText}. Name matches. Statement in date.`;
  return { checks, outcome, message };
}

export function maskAccountNumber(accountNumber: string | null | undefined): string {
  const value = (accountNumber || "").replace(/\s+/g, "");
  if (!value) return "****";
  const tail = value.slice(-4);
  return `****${tail}`;
}
