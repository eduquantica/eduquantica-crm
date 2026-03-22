import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationService } from "@/lib/notifications";

type TabFilter = "ALL" | "UNREAD" | "APPLICATIONS" | "DOCUMENTS" | "COMMISSIONS" | "SYSTEM" | "FINANCE" | "MESSAGES";

function isFinanceType(type: string): boolean {
  return type.startsWith("COMMISSION_")
    || type.startsWith("INVOICE_")
    || type.startsWith("FINANCE_")
    || type.includes("BANK_STATEMENT")
    || type.includes("FINANCIAL");
}

function isMessageType(type: string): boolean {
  return type.includes("MESSAGE") || type.includes("CHAT");
}

function getImmigrationAlertId(linkUrl?: string | null): string | null {
  if (!linkUrl) return null;
  try {
    const url = new URL(linkUrl, "http://localhost");
    return url.searchParams.get("immigrationAlertId");
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") || "ALL").toUpperCase() as TabFilter;
    const limit = Number(searchParams.get("limit") || 50);

    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
      select: {
        id: true,
        type: true,
        message: true,
        linkUrl: true,
        isRead: true,
        createdAt: true,
      },
    });

    const unreadCount = await NotificationService.getUnreadCount(session.user.id);

    const immigrationAlertIds = notifications
      .map((item) => getImmigrationAlertId(item.linkUrl))
      .filter((id): id is string => Boolean(id));

    const immigrationAlerts = immigrationAlertIds.length
      ? await db.immigrationRuleAlert.findMany({
          where: { id: { in: immigrationAlertIds } },
          select: {
            id: true,
            country: true,
            pageUrl: true,
            oldContent: true,
            newContent: true,
            oldMonthlyLivingCost: true,
            newMonthlyLivingCost: true,
            currency: true,
            detectedAt: true,
            status: true,
          },
        })
      : [];

    const alertById = new Map(immigrationAlerts.map((alert) => [alert.id, alert]));

    const mapped = notifications.map((n) => {
      const alertId = getImmigrationAlertId(n.linkUrl);
      const alert = alertId ? alertById.get(alertId) : null;

      return {
        ...n,
        createdAt: n.createdAt.toISOString(),
        category: NotificationService.category(n.type),
        immigrationAlert: alert
          ? {
              id: alert.id,
              country: alert.country,
              pageUrl: alert.pageUrl,
              oldContent: alert.oldContent,
              newContent: alert.newContent,
              oldMonthlyLivingCost: alert.oldMonthlyLivingCost,
              newMonthlyLivingCost: alert.newMonthlyLivingCost,
              currency: alert.currency,
              detectedAt: alert.detectedAt.toISOString(),
              status: alert.status,
            }
          : null,
      };
    });

    const filtered = mapped.filter((item) => {
      if (tab === "ALL") return true;
      if (tab === "UNREAD") return !item.isRead;
      if (tab === "FINANCE") return isFinanceType(item.type);
      if (tab === "MESSAGES") return isMessageType(item.type);
      return item.category === tab;
    });

    const unreadImmigrationCount = await db.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        type: "IMMIGRATION_RULE_CHANGE",
      },
    });

    return NextResponse.json({
      data: filtered,
      unreadCount,
      unreadImmigrationCount,
    });
  } catch (e) {
    console.error("[/api/notifications GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
