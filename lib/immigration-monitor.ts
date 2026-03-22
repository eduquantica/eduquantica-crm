import crypto from "crypto";
import { db } from "@/lib/db";
import { normalizeCountryCode, resolveFinancialRequirement } from "@/lib/financial-requirements";
import { NotificationService } from "@/lib/notifications";
import { sendMail } from "@/lib/email";

type ExtractedContent = {
  keyContent: string;
  rawContent: string;
  monthlyLivingCost: number | null;
  currency: string | null;
};

type CheckResult = {
  pageUrl: string;
  country: string;
  changed: boolean;
  alertId?: string;
  status: "ok" | "error";
  message: string;
};

type FinancialSetting = {
  monthlyLivingCost: number;
  currency: string;
};

const IMMIGRATION_NOTIFICATION_TYPE = "IMMIGRATION_RULE_CHANGE";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyLines(text: string): string[] {
  const slices = text
    .split(/(?<=[\.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const keywords = [
    "financial",
    "maintenance",
    "living",
    "fund",
    "bank",
    "statement",
    "month",
    "day",
    "evidence",
    "requirement",
    "visa",
    "student",
    "proof",
    "cost",
    "tuition",
    "deposit",
  ];

  const selected = slices.filter((line) => {
    const lower = line.toLowerCase();
    const hasKeyword = keywords.some((keyword) => lower.includes(keyword));
    const hasNumber = /\d/.test(line);
    return hasKeyword || hasNumber;
  });

  return selected.slice(0, 120);
}

function extractMonthlyFigure(text: string): { amount: number | null; currency: string | null } {
  const monthlySentence = text
    .split(/(?<=[\.!?])\s+/)
    .find((line) => /monthly|per month|living cost|maintenance/i.test(line));

  const source = monthlySentence || text;
  const moneyPatterns: Array<{ regex: RegExp; currency: string }> = [
    { regex: /£\s?([\d,]+(?:\.\d+)?)/, currency: "GBP" },
    { regex: /\bGBP\s?([\d,]+(?:\.\d+)?)/i, currency: "GBP" },
    { regex: /\bCAD\s?([\d,]+(?:\.\d+)?)/i, currency: "CAD" },
    { regex: /\bAUD\s?([\d,]+(?:\.\d+)?)/i, currency: "AUD" },
    { regex: /\bUSD\s?([\d,]+(?:\.\d+)?)/i, currency: "USD" },
    { regex: /\$\s?([\d,]+(?:\.\d+)?)/, currency: "USD" },
  ];

  for (const pattern of moneyPatterns) {
    const match = source.match(pattern.regex);
    if (!match?.[1]) continue;
    const amount = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(amount)) {
      return { amount, currency: pattern.currency };
    }
  }

  return { amount: null, currency: null };
}

function makeDiffSummary(oldContent: string, newContent: string): string {
  if (!oldContent) return "Initial snapshot captured.";

  const oldLines = oldContent.split("\n").map((line) => line.trim()).filter(Boolean);
  const newLines = newContent.split("\n").map((line) => line.trim()).filter(Boolean);
  const removed = oldLines.filter((line) => !newLines.includes(line)).slice(0, 3);
  const added = newLines.filter((line) => !oldLines.includes(line)).slice(0, 3);

  const removedText = removed.length ? `Removed: ${removed.join(" | ")}` : "Removed: none";
  const addedText = added.length ? `Added: ${added.join(" | ")}` : "Added: none";

  return `${removedText}. ${addedText}.`;
}

export async function getCurrentFinancialSettingForCountry(country: string): Promise<FinancialSetting> {
  const countryCode = normalizeCountryCode(country);
  const defaultRule = resolveFinancialRequirement(countryCode);

  const latestOverride = await db.activityLog.findFirst({
    where: {
      entityType: "financialRequirementSettings",
      entityId: countryCode,
      action: "upsert",
    },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });

  if (!latestOverride?.details) {
    return { monthlyLivingCost: defaultRule.monthlyLivingCost, currency: defaultRule.currency };
  }

  try {
    const parsed = JSON.parse(latestOverride.details || "{}");
    return {
      monthlyLivingCost: Number(parsed.monthlyLivingCost || defaultRule.monthlyLivingCost),
      currency: String(parsed.currency || defaultRule.currency).toUpperCase(),
    };
  } catch {
    return { monthlyLivingCost: defaultRule.monthlyLivingCost, currency: defaultRule.currency };
  }
}

async function notifyAdmins(alertId: string, country: string) {
  const admins = await db.user.findMany({
    where: {
      role: { name: "ADMIN" },
      isActive: true,
    },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      NotificationService.createNotification({
        userId: admin.id,
        type: IMMIGRATION_NOTIFICATION_TYPE,
        message: `Immigration Rule Update Detected for ${country}`,
        linkUrl: `/dashboard/settings?immigrationAlertId=${alertId}`,
      }),
    ),
  );
}

export async function extractImmigrationContent(pageUrl: string): Promise<ExtractedContent> {
  const response = await fetch(pageUrl, {
    method: "GET",
    headers: {
      "User-Agent": "EduQuantica-ImmigrationMonitor/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${pageUrl}`);
  }

  const rawContent = await response.text();
  const plainText = htmlToText(rawContent);
  const keyLines = extractKeyLines(plainText);
  const keyContent = keyLines.join("\n").slice(0, 30000);
  const figure = extractMonthlyFigure(keyContent);

  return {
    keyContent,
    rawContent: rawContent.slice(0, 200000),
    monthlyLivingCost: figure.amount,
    currency: figure.currency,
  };
}

export async function checkForChanges(pageUrl: string): Promise<CheckResult> {
  const monitoredPage = await db.immigrationMonitoredPage.findUnique({
    where: { pageUrl },
    select: { id: true, country: true, pageUrl: true },
  });

  if (!monitoredPage) {
    throw new Error(`Monitored page not found for URL: ${pageUrl}`);
  }

  try {
    const extracted = await extractImmigrationContent(pageUrl);
    const contentHash = crypto.createHash("sha256").update(extracted.keyContent).digest("hex");

    const lastSnapshot = await db.immigrationPageSnapshot.findFirst({
      where: { monitoredPageId: monitoredPage.id },
      orderBy: { createdAt: "desc" },
      select: { contentHash: true, keyContent: true },
    });

    const hasChanged = Boolean(lastSnapshot && lastSnapshot.contentHash !== contentHash);

    let alertId: string | undefined;
    if (hasChanged && lastSnapshot) {
      const currentSetting = await getCurrentFinancialSettingForCountry(monitoredPage.country);
      const diffSummary = makeDiffSummary(lastSnapshot.keyContent, extracted.keyContent);

      const alert = await db.immigrationRuleAlert.create({
        data: {
          monitoredPageId: monitoredPage.id,
          country: normalizeCountryCode(monitoredPage.country),
          pageUrl,
          oldContent: lastSnapshot.keyContent,
          newContent: extracted.keyContent,
          oldMonthlyLivingCost: currentSetting.monthlyLivingCost,
          newMonthlyLivingCost: extracted.monthlyLivingCost,
          currency: extracted.currency || currentSetting.currency,
          diffSummary,
          status: "PENDING_REVIEW",
        },
        select: { id: true },
      });

      alertId = alert.id;
      await notifyAdmins(alert.id, monitoredPage.country);

      await db.immigrationMonitoredPage.update({
        where: { id: monitoredPage.id },
        data: { lastChangedAt: new Date(), status: "ACTIVE" },
      });
    }

    await db.immigrationPageSnapshot.create({
      data: {
        monitoredPageId: monitoredPage.id,
        contentHash,
        keyContent: extracted.keyContent,
        rawContent: extracted.rawContent,
      },
    });

    await db.immigrationMonitoredPage.update({
      where: { id: monitoredPage.id },
      data: {
        lastCheckedAt: new Date(),
        status: "ACTIVE",
      },
    });

    return {
      pageUrl,
      country: monitoredPage.country,
      changed: hasChanged,
      alertId,
      status: "ok",
      message: hasChanged ? "Change detected" : "No change",
    };
  } catch (error) {
    await db.immigrationMonitoredPage.update({
      where: { id: monitoredPage.id },
      data: {
        lastCheckedAt: new Date(),
        status: "ERROR",
      },
    });

    return {
      pageUrl,
      country: monitoredPage.country,
      changed: false,
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function runImmigrationMonitoringBatch() {
  const pages = await db.immigrationMonitoredPage.findMany({
    where: { isActive: true },
    orderBy: [{ country: "asc" }, { createdAt: "asc" }],
    select: { pageUrl: true },
  });

  const results: CheckResult[] = [];
  for (const page of pages) {
    const result = await checkForChanges(page.pageUrl);
    results.push(result);
  }

  return results;
}

function lineValue(value?: number | null, currency?: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value} ${currency || ""}`.trim();
}

export async function publishImmigrationUpdate(alertId: string, confirmedByUserId: string) {
  const alert = await db.immigrationRuleAlert.findUnique({
    where: { id: alertId },
    include: {
      monitoredPage: true,
    },
  });

  if (!alert) {
    throw new Error("Alert not found");
  }

  if (alert.status !== "PENDING_REVIEW") {
    throw new Error("Alert is not pending review");
  }

  const latestSettingsUpdate = await db.activityLog.findFirst({
    where: {
      entityType: "financialRequirementSettings",
      entityId: normalizeCountryCode(alert.country),
      action: "upsert",
      createdAt: { gte: alert.detectedAt },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!latestSettingsUpdate) {
    throw new Error("Update Financial Requirements settings first before confirming");
  }

  const countryCode = normalizeCountryCode(alert.country);
  const currentSetting = await getCurrentFinancialSettingForCountry(countryCode);
  const oldValue = alert.oldMonthlyLivingCost;
  const newValue = currentSetting.monthlyLivingCost;
  const currency = currentSetting.currency;

  const changeSummary = `${countryCode} financial requirements updated. Living costs changed from ${lineValue(oldValue, currency)} to ${lineValue(newValue, currency)} per month.`;

  const updated = await db.$transaction(async (tx) => {
    const changelog = await tx.immigrationRuleChangelog.create({
      data: {
        alertId: alert.id,
        country: countryCode,
        oldMonthlyLivingCost: oldValue,
        newMonthlyLivingCost: newValue,
        currency,
        summary: changeSummary,
        confirmedByUserId,
      },
    });

    const updatedAlert = await tx.immigrationRuleAlert.update({
      where: { id: alert.id },
      data: {
        status: "CONFIRMED_PUBLISHED",
        confirmedByUserId,
        confirmedAt: new Date(),
        settingsUpdatedAt: latestSettingsUpdate.createdAt,
        notificationPublishedAt: new Date(),
      },
    });

    return { changelog, updatedAlert };
  });

  const [counsellorsAndManagers, subAgents, studentUsers, applications] = await Promise.all([
    db.user.findMany({
      where: {
        role: { name: { in: ["COUNSELLOR", "MANAGER"] } },
        isActive: true,
      },
      select: { id: true, email: true, name: true },
    }),
    db.user.findMany({
      where: {
        role: { name: "SUB_AGENT" },
        isActive: true,
      },
      select: { id: true, email: true, name: true },
    }),
    db.user.findMany({
      where: {
        role: { name: "STUDENT" },
        isActive: true,
        student: {
          applications: {
            some: {},
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        student: {
          select: {
            applications: {
              select: {
                university: { select: { country: true } },
              },
            },
          },
        },
      },
    }),
    db.application.findMany({
      select: {
        id: true,
        createdAt: true,
        university: { select: { country: true } },
      },
    }),
  ]);

  const affectedStudents = studentUsers.filter((user) =>
    (user.student?.applications || []).some(
      (application) => normalizeCountryCode(application.university.country) === countryCode,
    ),
  );

  const affectedApplications = applications.filter(
    (application) => normalizeCountryCode(application.university.country) === countryCode,
  );

  await Promise.all([
    ...counsellorsAndManagers.map((user) =>
      NotificationService.createNotification({
        userId: user.id,
        type: "IMMIGRATION_RULE_PUBLISHED_COUNSELLOR",
        message: `${countryCode} financial requirements updated. Living costs changed from ${lineValue(oldValue, currency)} to ${lineValue(newValue, currency)} per month. Review affected applications.`,
        linkUrl: "/dashboard/applications",
      }),
    ),
    ...subAgents.map((user) =>
      NotificationService.createNotification({
        userId: user.id,
        type: "IMMIGRATION_RULE_PUBLISHED_SUB_AGENT",
        message: `${countryCode} visa requirements updated. Please inform your students.`,
        linkUrl: "/agent/students",
      }),
    ),
    ...affectedStudents.map((user) =>
      NotificationService.createNotification({
        userId: user.id,
        type: "IMMIGRATION_RULE_PUBLISHED_STUDENT",
        message: `Financial requirements for ${countryCode} have been updated. Review your Finance section.`,
        linkUrl: "/student/applications",
      }),
    ),
  ]);

  await Promise.allSettled([
    ...counsellorsAndManagers.filter((user) => Boolean(user.email)).map((user) =>
      sendMail({
        to: user.email!,
        subject: `${countryCode} financial requirements updated`,
        text: `${changeSummary}\n\nPlease review affected applications in the dashboard.`,
      }),
    ),
    ...subAgents.filter((user) => Boolean(user.email)).map((user) =>
      sendMail({
        to: user.email!,
        subject: `${countryCode} visa requirements updated`,
        text: `${changeSummary}\n\nPlease inform your students and review your list.`,
      }),
    ),
    ...affectedStudents.filter((user) => Boolean(user.email)).map((user) =>
      sendMail({
        to: user.email!,
        subject: `${countryCode} financial requirements changed`,
        text: `The financial requirements for ${countryCode} have changed.\nOld amount: ${lineValue(oldValue, currency)}\nNew amount: ${lineValue(newValue, currency)}\nPlease review your Finance section in EduQuantica.`,
      }),
    ),
  ]);

  const actor = await db.user.findUnique({ where: { id: confirmedByUserId }, select: { id: true } });
  if (actor?.id) {
    await db.activityLog.create({
      data: {
        userId: actor.id,
        entityType: "immigrationMonitor",
        entityId: updated.changelog.id,
        action: "published_update",
        details: JSON.stringify({
          country: countryCode,
          alertId,
          affectedApplications: affectedApplications.length,
          oldMonthlyLivingCost: oldValue,
          newMonthlyLivingCost: newValue,
          currency,
        }),
      },
    });
  }

  return {
    alertId,
    countryCode,
    oldMonthlyLivingCost: oldValue,
    newMonthlyLivingCost: newValue,
    currency,
    changelogId: updated.changelog.id,
    affectedApplications: affectedApplications.length,
  };
}

export async function getLatestCountryUpdateMap() {
  const rows = await db.immigrationRuleChangelog.findMany({
    orderBy: { createdAt: "desc" },
    include: { alert: { select: { status: true } } },
  });

  const map = new Map<string, { createdAt: Date; summary: string }>();
  for (const row of rows) {
    if (row.alert.status !== "CONFIRMED_PUBLISHED") continue;
    if (!map.has(row.country)) {
      map.set(row.country, {
        createdAt: row.createdAt,
        summary: row.summary,
      });
    }
  }

  return map;
}
