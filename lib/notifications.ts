import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";

export type NotificationCategory = "APPLICATIONS" | "DOCUMENTS" | "COMMISSIONS" | "SYSTEM";

export type NotificationChannelSettings = {
  portal: boolean;
  email: boolean;
  sms: boolean;
};

type StudentNotificationPreferences = {
  financePortalNotifications: boolean;
  financeEmailNotifications: boolean;
  messagePortalNotifications: boolean;
  messageEmailNotifications: boolean;
};

type CreateNotificationInput = {
  userId: string;
  type: string;
  message: string;
  linkUrl?: string | null;
  actorUserId?: string;
};

const SETTINGS_ENTITY_TYPE = "notification_settings";
const SETTINGS_ACTION = "updated";

function inferCategory(type: string): NotificationCategory {
  if (type.startsWith("APPLICATION_") || type.startsWith("SUB_AGENT_APPLICATION_")) return "APPLICATIONS";
  if (type.startsWith("DOCUMENT_") || type.startsWith("CHECKLIST_")) return "DOCUMENTS";
  if (type.startsWith("COMMISSION_") || type.startsWith("INVOICE_")) return "COMMISSIONS";
  return "SYSTEM";
}

function inferStudentPreferenceCategory(type: string): "finance" | "messages" | null {
  if (
    type.startsWith("COMMISSION_")
    || type.startsWith("INVOICE_")
    || type.startsWith("FINANCE_")
    || type.includes("BANK_STATEMENT")
    || type.includes("FINANCIAL")
  ) {
    return "finance";
  }

  if (type.includes("MESSAGE") || type.includes("CHAT")) {
    return "messages";
  }

  return null;
}

async function getStudentPreferencesByUserId(userId: string): Promise<StudentNotificationPreferences | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: { select: { name: true } },
      student: {
        select: {
          preferences: {
            select: {
              financePortalNotifications: true,
              financeEmailNotifications: true,
              messagePortalNotifications: true,
              messageEmailNotifications: true,
            },
          },
        },
      },
    },
  });

  if (user?.role?.name !== "STUDENT") return null;

  return {
    financePortalNotifications: user.student?.preferences?.financePortalNotifications ?? true,
    financeEmailNotifications: user.student?.preferences?.financeEmailNotifications ?? true,
    messagePortalNotifications: user.student?.preferences?.messagePortalNotifications ?? true,
    messageEmailNotifications: user.student?.preferences?.messageEmailNotifications ?? true,
  };
}

async function getSettingsLog(userId: string) {
  return db.activityLog.findFirst({
    where: {
      userId,
      entityType: SETTINGS_ENTITY_TYPE,
      action: SETTINGS_ACTION,
    },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });
}

export class NotificationService {
  static async getChannelSettings(userId: string): Promise<NotificationChannelSettings> {
    const defaults: NotificationChannelSettings = {
      portal: true,
      email: true,
      sms: false,
    };

    const row = await getSettingsLog(userId);
    if (!row?.details) return defaults;

    try {
      const parsed = JSON.parse(row.details) as Partial<NotificationChannelSettings>;
      return {
        portal: parsed.portal ?? defaults.portal,
        email: parsed.email ?? defaults.email,
        sms: parsed.sms ?? defaults.sms,
      };
    } catch {
      return defaults;
    }
  }

  static async updateChannelSettings(userId: string, settings: Partial<NotificationChannelSettings>) {
    const current = await NotificationService.getChannelSettings(userId);
    const merged: NotificationChannelSettings = {
      portal: settings.portal ?? current.portal,
      email: settings.email ?? current.email,
      sms: settings.sms ?? current.sms,
    };

    await db.activityLog.create({
      data: {
        userId,
        entityType: SETTINGS_ENTITY_TYPE,
        entityId: userId,
        action: SETTINGS_ACTION,
        details: JSON.stringify(merged),
      },
    });

    return merged;
  }

  static async createNotification(input: CreateNotificationInput) {
    const [settings, studentPreferences] = await Promise.all([
      NotificationService.getChannelSettings(input.userId),
      getStudentPreferencesByUserId(input.userId),
    ]);

    const preferenceCategory = inferStudentPreferenceCategory(input.type);
    const allowsPortal = preferenceCategory === "finance"
      ? (studentPreferences?.financePortalNotifications ?? true)
      : preferenceCategory === "messages"
        ? (studentPreferences?.messagePortalNotifications ?? true)
        : true;

    let created = null;
    if (settings.portal && allowsPortal) {
      created = await db.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          message: input.message,
          linkUrl: input.linkUrl ?? null,
        },
      });
    }

    if (settings.sms) {
      await db.activityLog.create({
        data: {
          userId: input.userId,
          entityType: "notification",
          entityId: created?.id ?? "sms-only",
          action: "sms_queued",
          details: input.message,
        },
      }).catch(() => undefined);
    }

    return created;
  }

  static async getUnreadCount(userId: string) {
    return db.notification.count({ where: { userId, isRead: false } });
  }

  static async markAsRead(userId: string, notificationId: string) {
    return db.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });
  }

  static async sendEmailDigest(userId: string) {
    const [settings, studentPreferences] = await Promise.all([
      NotificationService.getChannelSettings(userId),
      getStudentPreferencesByUserId(userId),
    ]);

    if (!settings.email) return { sent: false, reason: "EMAIL_DISABLED" as const };

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) return { sent: false, reason: "NO_EMAIL" as const };

    const items = await db.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        message: true,
        type: true,
        createdAt: true,
      },
    });

    const filteredItems = items.filter((item) => {
      const preferenceCategory = inferStudentPreferenceCategory(item.type);
      if (preferenceCategory === "finance") return studentPreferences?.financeEmailNotifications ?? true;
      if (preferenceCategory === "messages") return studentPreferences?.messageEmailNotifications ?? true;
      return true;
    });

    if (filteredItems.length === 0) return { sent: false, reason: "NO_ITEMS" as const };

    const htmlList = filteredItems
      .map((item) => `<li><strong>${item.type}</strong> — ${item.message}</li>`)
      .join("");

    await sendMail({
      to: user.email,
      subject: "Your EduQuantica notifications digest",
      text: filteredItems.map((item) => `${item.type}: ${item.message}`).join("\n"),
      html: `<p>Hi ${user.name || "there"},</p><p>Here is your latest notification digest:</p><ul>${htmlList}</ul>`,
    });

    return { sent: true as const, count: filteredItems.length };
  }

  static category(type: string): NotificationCategory {
    return inferCategory(type);
  }
}
