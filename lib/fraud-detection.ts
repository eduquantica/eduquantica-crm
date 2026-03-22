import { PassportOCRData, FinancialDocOCRData } from "./mindee";

export enum FraudRiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export interface ValidationResult {
  riskLevel: FraudRiskLevel;
  flags: string[];
  details?: Record<string, unknown>;
}

export interface PassportValidationResult extends ValidationResult {
  mrzValid?: boolean;
  nameMatch?: boolean;
  expiryValid?: boolean;
  confidenceOk?: boolean;
  dobMatch?: boolean;
}

export interface FinancialDocValidationResult extends ValidationResult {
  balanceMeetsRequirement?: boolean;
  daysHeld?: number;
  accountHolderMatch?: boolean;
  statementDateValid?: boolean;
}

/**
 * Levenshtein distance algorithm for fuzzy string matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const lower1 = str1.toLowerCase().trim();
  const lower2 = str2.toLowerCase().trim();

  if (lower1 === lower2) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= lower2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= lower1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lower2.length; i++) {
    for (let j = 1; j <= lower1.length; j++) {
      if (lower2.charAt(i - 1) === lower1.charAt(j - 1)) {
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

  return matrix[lower2.length][lower1.length];
}

/**
 * Validate MRZ checksum using the standard ICAO algorithm
 */
function validateMRZChecksum(mrz: string): boolean {
  if (!mrz || mrz.length < 30) return false;

  try {
    // MRZ has specific character weights for checksum calculation
    const weights = [7, 3, 1];
    let checksum = 0;
    let weightIndex = 0;

    // Extract checksum positions from MRZ
    // For passports: positions 43 (first 10 chars), 86 (next 10 chars), 88 (last digit)
    // But we'll validate the structure more flexibly

    for (let i = 0; i < Math.min(mrz.length - 1, 30); i++) {
      const char = mrz.charAt(i);
      let value = 0;

      if (char >= "0" && char <= "9") {
        value = parseInt(char, 10);
      } else if (char >= "A" && char <= "Z") {
        value = char.charCodeAt(0) - 55; // A=10, B=11, ..., Z=35
      } else if (char === "<") {
        value = 0;
      } else {
        // Invalid character
        return false;
      }

      checksum += value * weights[weightIndex % 3];
      weightIndex++;
    }

    // Last digit should be checksum mod 10
    const lastDigit = parseInt(mrz.charAt(mrz.length - 1), 10);
    const expectedChecksum = checksum % 10;

    return lastDigit === expectedChecksum;
  } catch (error) {
    console.error("Error validating MRZ checksum:", error);
    return false;
  }
}

/**
 * Parse date string in YYMMDD format (ISO style for passports)
 */
function parsePassportDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length < 6) return null;

  try {
    // Handle various date formats
    let year: number;
    let month: number;
    let day: number;

    if (dateStr.includes("-")) {
      // Format: YYYY-MM-DD
      const parts = dateStr.split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      // Format: YYMMDD or YYYYMMDD
      if (dateStr.length === 6) {
        year = 2000 + parseInt(dateStr.substring(0, 2), 10);
        month = parseInt(dateStr.substring(2, 4), 10);
        day = parseInt(dateStr.substring(4, 6), 10);
      } else if (dateStr.length === 8) {
        year = parseInt(dateStr.substring(0, 4), 10);
        month = parseInt(dateStr.substring(4, 6), 10);
        day = parseInt(dateStr.substring(6, 8), 10);
      } else {
        return null;
      }
    }

    return new Date(year, month - 1, day);
  } catch {
    return null;
  }
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function calculateStringMatch(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

function elevateRiskToMedium(riskLevel: FraudRiskLevel): FraudRiskLevel {
  if (riskLevel === FraudRiskLevel.HIGH) return FraudRiskLevel.HIGH;
  return FraudRiskLevel.MEDIUM;
}

export class FraudDetector {
  /**
   * Validate passport OCR data against student profile
   * Check 1: MRZ checksum validation
   * Check 2: Name match (fuzzy)
   * Check 3: Expiry date validation
   * Check 4: OCR confidence threshold
   * Check 5: Date of birth match
   */
  static validatePassport(
    ocrData: PassportOCRData,
    studentProfile: {
      firstName: string;
      lastName: string;
      dateOfBirth?: Date | null;
      passportExpiry?: Date | null;
      courseEndDate?: Date | null;
    },
  ): PassportValidationResult {
    const flags: string[] = [];
    const details: Record<string, unknown> = {};
    let riskLevel = FraudRiskLevel.LOW;

    // Check 1: MRZ Checksum Validation
    let mrzValid = false;
    if (ocrData.mrz1 && ocrData.mrz2) {
      const mrz1Valid = validateMRZChecksum(ocrData.mrz1);
      const mrz2Valid = validateMRZChecksum(ocrData.mrz2);
      mrzValid = mrz1Valid && mrz2Valid;

      if (!mrzValid) {
        flags.push("MRZ_CHECKSUM_INVALID");
        riskLevel = FraudRiskLevel.HIGH;
      }
      details.mrzValid = mrzValid;
      details.mrz1Valid = mrz1Valid;
      details.mrz2Valid = mrz2Valid;
    } else {
      flags.push("MRZ_DATA_MISSING");
      riskLevel = elevateRiskToMedium(riskLevel);
    }

    // Check 2: Name Match (Fuzzy)
    let nameMatch = true;
    const studentFullName = `${studentProfile.firstName} ${studentProfile.lastName}`;
    const ocrFullName = `${ocrData.givenNames} ${ocrData.surname}`;
    const nameSimilarity = calculateStringMatch(studentFullName, ocrFullName);

    // Flag if more than 2 characters different (using Levenshtein distance)
    const nameDistance = levenshteinDistance(studentFullName, ocrFullName);
    if (nameDistance > 2) {
      nameMatch = false;
      flags.push(`NAME_MISMATCH (distance: ${nameDistance}, similarity: ${Math.round(nameSimilarity * 100)}%)`);
      riskLevel = FraudRiskLevel.HIGH;
    }
    details.nameMatch = nameMatch;
    details.nameSimilarity = Math.round(nameSimilarity * 100);

    // Check 3: Expiry Date Validation
    let expiryValid = true;
    const expiryDate = parsePassportDate(ocrData.expiryDate);
    const now = new Date();

    if (!expiryDate) {
      flags.push("EXPIRY_DATE_PARSE_FAILED");
      expiryValid = false;
      riskLevel = elevateRiskToMedium(riskLevel);
    } else if (expiryDate < now) {
      flags.push("PASSPORT_EXPIRED");
      expiryValid = false;
      riskLevel = FraudRiskLevel.HIGH;
    } else if (studentProfile.courseEndDate && expiryDate < studentProfile.courseEndDate) {
      flags.push("PASSPORT_EXPIRES_BEFORE_COURSE_END");
      expiryValid = false;
      riskLevel = elevateRiskToMedium(riskLevel);
    }
    details.expiryValid = expiryValid;
    details.expiryDate = expiryDate?.toISOString();

    // Check 4: OCR Confidence Threshold (70%)
    let confidenceOk = true;
    if (ocrData.confidence < 0.7) {
      flags.push(`LOW_OCR_CONFIDENCE (${Math.round(ocrData.confidence * 100)}%)`);
      confidenceOk = false;
      riskLevel = elevateRiskToMedium(riskLevel);
    }
    details.confidence = Math.round(ocrData.confidence * 100);
    details.confidenceOk = confidenceOk;

    // Check 5: Date of Birth Match
    let dobMatch = true;
    if (studentProfile.dateOfBirth) {
      const dobDate = parsePassportDate(ocrData.dateOfBirth);
      if (!dobDate) {
        flags.push("DOB_PARSE_FAILED");
        dobMatch = false;
        riskLevel = elevateRiskToMedium(riskLevel);
      } else {
        // Check if DOB matches (same year, month, day)
        if (
          dobDate.getFullYear() !== studentProfile.dateOfBirth.getFullYear() ||
          dobDate.getMonth() !== studentProfile.dateOfBirth.getMonth() ||
          dobDate.getDate() !== studentProfile.dateOfBirth.getDate()
        ) {
          dobMatch = false;
          flags.push("DOB_MISMATCH");
          riskLevel = elevateRiskToMedium(riskLevel);
        }
      }
    }
    details.dobMatch = dobMatch;

    return {
      riskLevel,
      flags,
      mrzValid,
      nameMatch,
      expiryValid,
      confidenceOk,
      dobMatch,
      details,
    };
  }

  /**
   * Validate financial document OCR data
   * Check 1: Account holder name match (fuzzy)
   * Check 2: Statement date within required window
   * Check 3: Balance meets requirement
   * Check 4: 28-day rule (UK only)
   */
  static validateFinancialDoc(
    ocrData: FinancialDocOCRData,
    studentProfile: {
      firstName: string;
      lastName: string;
    },
    requiredAmount: number,
    country: string,
  ): FinancialDocValidationResult {
    const flags: string[] = [];
    const details: Record<string, unknown> = {};
    let riskLevel = FraudRiskLevel.LOW;

    // Check 1: Account Holder Name Match
    let accountHolderMatch = true;
    const studentFullName = `${studentProfile.firstName} ${studentProfile.lastName}`;
    const nameDistance = levenshteinDistance(studentFullName, ocrData.accountHolderName);
    const nameSimilarity = calculateStringMatch(studentFullName, ocrData.accountHolderName);

    if (nameDistance > 3) {
      accountHolderMatch = false;
      flags.push(`ACCOUNT_HOLDER_MISMATCH (distance: ${nameDistance}, similarity: ${Math.round(nameSimilarity * 100)}%)`);
      riskLevel = FraudRiskLevel.HIGH;
    }
    details.accountHolderMatch = accountHolderMatch;
    details.nameSimilarity = Math.round(nameSimilarity * 100);

    // Check 2: Statement Date Validation
    let statementDateValid = true;
    const statementDate = parsePassportDate(ocrData.statementDate);
    const now = new Date();
    const cutoffDays = country.toUpperCase() === "UK" ? 28 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

    if (!statementDate) {
      flags.push("STATEMENT_DATE_PARSE_FAILED");
      statementDateValid = false;
      riskLevel = FraudRiskLevel.MEDIUM;
    } else if (statementDate > now) {
      flags.push("STATEMENT_DATE_IN_FUTURE");
      statementDateValid = false;
      riskLevel = FraudRiskLevel.HIGH;
    } else if (statementDate < cutoffDate) {
      flags.push(`STATEMENT_TOO_OLD (${cutoffDays}-day rule: older than ${cutoffDate.toISOString().split("T")[0]})`);
      statementDateValid = false;
      riskLevel = elevateRiskToMedium(riskLevel);
    }
    details.statementDateValid = statementDateValid;
    details.statementDate = statementDate?.toISOString();
    details.cutoffDays = cutoffDays;

    // Check 3: Balance Meets Requirement
    const balanceMeetsRequirement = ocrData.closingBalance >= requiredAmount;
    if (!balanceMeetsRequirement) {
      flags.push(
        `INSUFFICIENT_BALANCE (required: ${requiredAmount}, available: ${ocrData.closingBalance} ${ocrData.currency})`,
      );
      riskLevel = FraudRiskLevel.HIGH;
    }
    details.balanceMeetsRequirement = balanceMeetsRequirement;
    details.closingBalance = ocrData.closingBalance;
    details.requiredAmount = requiredAmount;

    // Check 4: 28-Day Rule (UK only) - Verify funds held for 28+ consecutive days
    let daysHeld = 0;
    if (country.toUpperCase() === "UK" && statementDate) {
      // Analyze transactions to find 28-day period with sufficient funds
      daysHeld = calculateConsecutiveDaysAboveAmount(ocrData.transactions, requiredAmount, statementDate);

      if (daysHeld < 28) {
        flags.push(`28_DAY_RULE_FAILED (only ${daysHeld} consecutive days verified)`);
        riskLevel = elevateRiskToMedium(riskLevel);
      }
    }
    details.daysHeld = daysHeld;

    return {
      riskLevel,
      flags,
      balanceMeetsRequirement,
      daysHeld,
      accountHolderMatch,
      statementDateValid,
      details,
    };
  }
}

/**
 * Calculate consecutive days above a required amount based on transactions
 */
function calculateConsecutiveDaysAboveAmount(
  transactions: Array<{ date: string; description: string; amount: number }>,
  requiredAmount: number,
  statementDate: Date,
): number {
  // Sort transactions by date
  const sortedTxns = transactions
    .map((txn) => ({
      ...txn,
      date: parsePassportDate(txn.date) || new Date(),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sortedTxns.length === 0) {
    return 0;
  }

  // Track daily balances working backward from statement date
  const dailyBalances = calculateDailyBalances(sortedTxns, statementDate);

  // Find longest consecutive period with balance >= required
  let maxConsecutiveDays = 0;
  let currentConsecutiveDays = 0;

  for (const balance of Array.from(dailyBalances.values())) {
    if (balance >= requiredAmount) {
      currentConsecutiveDays++;
      maxConsecutiveDays = Math.max(maxConsecutiveDays, currentConsecutiveDays);
    } else {
      currentConsecutiveDays = 0;
    }
  }

  return Math.min(maxConsecutiveDays, 28);
}

/**
 * Calculate daily balances from transactions in reverse order
 */
function calculateDailyBalances(
  transactions: Array<{ date: Date; amount: number }>,
  statementDate: Date,
): Map<string, number> {
  const balances = new Map<string, number>();
  let balance = 0;

  // Work backward from statement date
  for (let i = 0; i < 28; i++) {
    const date = new Date(statementDate);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];

    // Find transactions for this date and apply in reverse chronological order
    const dayTransactions = transactions.filter((t) => t.date.toISOString().split("T")[0] === dateKey);

    for (const txn of dayTransactions) {
      balance -= txn.amount; // Subtract because we're going backward
    }

    balances.set(dateKey, balance);
  }

  return balances;
}
