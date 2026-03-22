export type GradeQualType =
  | "GCSE_ALEVEL"
  | "O_LEVEL"
  | "WAEC"
  | "NECO"
  | "SSC_HSC"
  | "IB"
  | "PERCENTAGE"
  | "GPA_4"
  | "FOUNDATION";

type GradeTable = Record<string, number>;

const GCSE_ALEVEL_TABLE: GradeTable = {
  "A*": 100,
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  E: 50,
  F: 40,
  G: 30,
  U: 0,
};

const WAEC_NECO_TABLE: GradeTable = {
  A1: 100,
  B2: 90,
  B3: 80,
  C4: 70,
  C5: 65,
  C6: 60,
  D7: 50,
  E8: 40,
  F9: 0,
};

const SSC_HSC_GPA_TABLE: GradeTable = {
  "5.0": 100,
  "4.5": 90,
  "4.0": 80,
  "3.5": 70,
  "3.0": 60,
  "2.5": 50,
  "2.0": 40,
  "1.0": 20,
};

const IB_TABLE: GradeTable = {
  "7": 100,
  "6": 86,
  "5": 72,
  "4": 57,
  "3": 43,
  "2": 28,
  "1": 14,
};

const FOUNDATION_TABLE: GradeTable = {
  DISTINCTION: 100,
  MERIT: 80,
  PASS: 60,
  FAIL: 0,
};

function normalizeGradeInput(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeQualType(value: string): GradeQualType | null {
  const q = value.trim().toUpperCase();

  if (q === "GCSE_ALEVEL" || q === "GCSE" || q === "A_LEVEL" || q === "ALEVEL") {
    return "GCSE_ALEVEL";
  }

  if (q === "O_LEVEL" || q === "OLEVEL") {
    return "O_LEVEL";
  }

  if (q === "WAEC") return "WAEC";
  if (q === "NECO") return "NECO";
  if (q === "SSC_HSC" || q === "SSC" || q === "HSC") return "SSC_HSC";
  if (q === "IB") return "IB";
  if (q === "PERCENTAGE" || q === "PERCENT") return "PERCENTAGE";
  if (q === "GPA_4" || q === "GPA4" || q === "GPA_4.0" || q === "GPA") return "GPA_4";
  if (q === "FOUNDATION") return "FOUNDATION";

  return null;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function closestDisplay(score: number, table: GradeTable): string {
  const entries = Object.entries(table);
  if (entries.length === 0) return "N/A";

  let bestGrade = entries[0][0];
  let bestScore = entries[0][1];
  let bestDiff = Math.abs(score - bestScore);

  for (let index = 1; index < entries.length; index += 1) {
    const [grade, mappedScore] = entries[index];
    const diff = Math.abs(score - mappedScore);

    if (diff < bestDiff || (diff === bestDiff && mappedScore > bestScore)) {
      bestGrade = grade;
      bestScore = mappedScore;
      bestDiff = diff;
    }
  }

  return bestGrade;
}

export class GradeNormaliser {
  static normalise(rawGrade: string, qualType: string): number | null {
    const canonicalType = normalizeQualType(qualType);
    if (!canonicalType) return null;

    const input = normalizeGradeInput(rawGrade);

    if (canonicalType === "GCSE_ALEVEL") {
      return GCSE_ALEVEL_TABLE[input] ?? null;
    }

    if (canonicalType === "O_LEVEL") {
      return GCSE_ALEVEL_TABLE[input] ?? null;
    }

    if (canonicalType === "WAEC" || canonicalType === "NECO") {
      return WAEC_NECO_TABLE[input] ?? null;
    }

    if (canonicalType === "SSC_HSC") {
      return SSC_HSC_GPA_TABLE[input] ?? null;
    }

    if (canonicalType === "IB") {
      return IB_TABLE[input] ?? null;
    }

    if (canonicalType === "FOUNDATION") {
      return FOUNDATION_TABLE[input] ?? null;
    }

    if (canonicalType === "PERCENTAGE") {
      const numeric = Number(input.replace(/%/g, ""));
      if (!Number.isFinite(numeric)) return null;
      if (numeric < 0 || numeric > 100) return null;
      return numeric;
    }

    if (canonicalType === "GPA_4") {
      const numeric = Number(input);
      if (!Number.isFinite(numeric)) return null;
      if (numeric < 0 || numeric > 4) return null;
      return clampScore(numeric * 25);
    }

    return null;
  }

  static detectQualType(nationality: string): GradeQualType {
    const code = nationality.trim().toUpperCase();

    if (code === "BD") return "SSC_HSC";
    if (code === "NG" || code === "GH") return "WAEC";
    if (code === "UK") return "GCSE_ALEVEL";
    if (code === "IN") return "PERCENTAGE";
    if (code === "PK") return "O_LEVEL";
    if (code.includes("INTERNATIONAL")) return "IB";

    return "IB";
  }

  static gradeToDisplay(universalScore: number, targetQualType: string): string {
    const canonicalType = normalizeQualType(targetQualType);
    if (!canonicalType) return "N/A";

    const score = clampScore(universalScore);

    if (canonicalType === "GCSE_ALEVEL" || canonicalType === "O_LEVEL") {
      return closestDisplay(score, GCSE_ALEVEL_TABLE);
    }

    if (canonicalType === "WAEC" || canonicalType === "NECO") {
      return closestDisplay(score, WAEC_NECO_TABLE);
    }

    if (canonicalType === "SSC_HSC") {
      return closestDisplay(score, SSC_HSC_GPA_TABLE);
    }

    if (canonicalType === "IB") {
      return closestDisplay(score, IB_TABLE);
    }

    if (canonicalType === "FOUNDATION") {
      return closestDisplay(score, FOUNDATION_TABLE);
    }

    if (canonicalType === "PERCENTAGE") {
      return `${Math.round(score)}%`;
    }

    if (canonicalType === "GPA_4") {
      return (score / 25).toFixed(1);
    }

    return "N/A";
  }
}
