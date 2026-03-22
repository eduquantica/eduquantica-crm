import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function staffGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const r = session.user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// Display labels and funnel order for Lead statuses
const LEAD_FUNNEL_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;
const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Interested",
  CONVERTED: "Applied",
  LOST: "Lost",
};

const APP_STATUS_LABELS: Record<string, string> = {
  APPLIED: "Application Submitted",
  DOCUMENTS_PENDING: "Docs Pending",
  DOCUMENTS_SUBMITTED: "Documents Verified",
  SUBMITTED_TO_UNIVERSITY: "Submitted To University",
  CONDITIONAL_OFFER: "Conditional Offer",
  UNCONDITIONAL_OFFER: "Unconditional Offer",
  FINANCE_IN_PROGRESS: "Finance Started",
  DEPOSIT_PAID: "Deposit Paid",
  FINANCE_COMPLETE: "Finance Complete",
  CAS_ISSUED: "CAS Issued",
  VISA_APPLIED: "Visa Applied",
  ENROLLED: "Enrolled",
  WITHDRAWN: "Withdrawn",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  const [leadGroups, appGroups] = await Promise.all([
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    db.application.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Build lead funnel in defined funnel order
  const leadCountMap: Record<string, number> = {};
  for (const g of leadGroups) leadCountMap[g.status] = g._count._all;

  const leadFunnel = LEAD_FUNNEL_ORDER.map((status) => ({
    status,
    label: LEAD_STATUS_LABELS[status] ?? status,
    count: leadCountMap[status] ?? 0,
  }));

  // Build application status breakdown (all statuses that exist in data)
  const appStatusOrder = Object.keys(APP_STATUS_LABELS);
  const appCountMap: Record<string, number> = {};
  for (const g of appGroups) appCountMap[g.status] = g._count._all;

  const applicationStatus = appStatusOrder
    .filter((s) => (appCountMap[s] ?? 0) > 0)
    .map((s) => ({
      status: s,
      label: APP_STATUS_LABELS[s] ?? s,
      count: appCountMap[s] ?? 0,
    }));

  // If no real data yet, return a representative empty set so the chart renders
  const applicationStatusOut =
    applicationStatus.length > 0
      ? applicationStatus
      : Object.entries(APP_STATUS_LABELS).map(([status, label]) => ({ status, label, count: 0 }));

  return NextResponse.json({ data: { leadFunnel, applicationStatus: applicationStatusOut } });
}
