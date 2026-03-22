import { KpiPeriod } from "@prisma/client";

export type PeriodPreset = "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "LAST_QUARTER" | "THIS_YEAR" | "CUSTOM";

export function getPeriodRangeFromPreset(
  preset: PeriodPreset,
  customStart?: string | null,
  customEnd?: string | null,
  now = new Date(),
) {
  if (preset === "CUSTOM" && customStart && customEnd) {
    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate, label: `${customStart} to ${customEnd}` };
  }

  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "LAST_MONTH") {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate, label: `${startDate.toLocaleString("en-GB", { month: "short", year: "numeric" })}` };
  }

  if (preset === "THIS_QUARTER" || preset === "LAST_QUARTER") {
    const quarter = Math.floor(month / 3);
    const qIndex = preset === "THIS_QUARTER" ? quarter : quarter - 1;
    const qYear = qIndex < 0 ? year - 1 : year;
    const qStartMonth = ((qIndex + 4) % 4) * 3;
    const startDate = new Date(qYear, qStartMonth, 1);
    const endDate = new Date(qYear, qStartMonth + 3, 0, 23, 59, 59, 999);
    return { startDate, endDate, label: `Q${Math.floor(qStartMonth / 3) + 1} ${qYear}` };
  }

  if (preset === "THIS_YEAR") {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    return { startDate, endDate, label: `${year}` };
  }

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate, label: `${startDate.toLocaleString("en-GB", { month: "short", year: "numeric" })}` };
}

export function inferKpiPeriod(startDate: Date, endDate: Date): KpiPeriod {
  const ms = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days <= 35) return "MONTHLY";
  if (days <= 110) return "QUARTERLY";
  if (days <= 380) return "ANNUALLY";
  return "INTAKE_SEASON";
}
