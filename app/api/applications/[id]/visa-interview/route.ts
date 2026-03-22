import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canActorRecordInterviewOutcome,
  getInterviewAccessContext,
  resolveUserNames,
} from "@/lib/interview-access";
import {
  buildInterviewNotificationContext,
  notifyInterviewBooked,
  notifyInterviewOutcome,
  notifyInterviewRequired,
} from "@/lib/interview-notifications";

type InterviewOutcome = "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED_BY_UNIVERSITY" | "NO_SHOW";
const INTERVIEW_OUTCOMES: InterviewOutcome[] = ["PASSED", "FAILED", "RESCHEDULED", "CANCELLED_BY_UNIVERSITY", "NO_SHOW"];

const prismaWithInterview = db as typeof db & {
  visaInterview: {
    upsert: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
  };
};

function toDateOrNull(value: unknown) {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toStringOrNull(value: unknown) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return String(value);
}

function sameValue(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === "string") return a.toISOString() === b;
  if (b instanceof Date && typeof a === "string") return b.toISOString() === a;
  return a === b;
}

async function serializeRecord(record: {
  markedRequiredBy: string | null;
  dateBookedBy: string | null;
  outcomeRecordedBy: string | null;
  markedRequiredAt: Date | null;
  dateBookedAt: Date | null;
  outcomeRecordedAt: Date | null;
  updatedAt: Date;
}) {
  const points = [
    { at: record.outcomeRecordedAt, by: record.outcomeRecordedBy },
    { at: record.dateBookedAt, by: record.dateBookedBy },
    { at: record.markedRequiredAt, by: record.markedRequiredBy },
  ].filter((row): row is { at: Date; by: string } => !!row.at && !!row.by);

  points.sort((a, b) => b.at.getTime() - a.at.getTime());
  const latest = points[0];

  const names = await resolveUserNames(latest?.by ? [latest.by] : []);

  return {
    lastUpdatedByName: latest?.by ? names.get(latest.by) || "Unknown" : "System",
    lastUpdatedAt: latest?.at || record.updatedAt,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getInterviewAccessContext(session, params.id);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await prismaWithInterview.visaInterview.upsert({
    where: { applicationId: params.id },
    create: { applicationId: params.id },
    update: {},
  });

  const meta = await serializeRecord(row);
  return NextResponse.json({ data: { ...row, ...meta } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getInterviewAccessContext(session, params.id);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = (await req.json()) as Record<string, unknown>;

  if (!canActorRecordInterviewOutcome(access)) {
    const blockedKeys = ["outcome", "outcomeDate", "outcomeNotes", "rescheduledDate", "cancelledReason"];
    if (blockedKeys.some((key) => key in payload)) {
      return NextResponse.json({ error: "Students cannot record interview outcome." }, { status: 403 });
    }
  }

  const current = await prismaWithInterview.visaInterview.upsert({
    where: { applicationId: params.id },
    create: { applicationId: params.id },
    update: {},
  });

  const updateData: Record<string, unknown> = {};

  if ("isRequired" in payload && typeof payload.isRequired === "boolean") {
    updateData.isRequired = payload.isRequired;
    if (payload.isRequired) {
      updateData.markedRequiredBy = access.actor.id;
      updateData.markedRequiredAt = new Date();
    }
  }

  if ("bookedDate" in payload) {
    const bookedDate = toDateOrNull(payload.bookedDate);
    if (bookedDate !== undefined) {
      updateData.bookedDate = bookedDate;
      if (bookedDate) {
        updateData.dateBookedBy = access.actor.id;
        updateData.dateBookedAt = new Date();
      }
    }
  }

  if ("location" in payload) {
    const location = toStringOrNull(payload.location);
    if (location !== undefined) updateData.location = location;
  }

  if ("outcome" in payload) {
    if (payload.outcome === null) {
      updateData.outcome = null;
      updateData.outcomeDate = null;
    } else if (typeof payload.outcome === "string" && INTERVIEW_OUTCOMES.includes(payload.outcome as InterviewOutcome)) {
      updateData.outcome = payload.outcome as InterviewOutcome;
      updateData.outcomeRecordedBy = access.actor.id;
      updateData.outcomeRecordedAt = new Date();
      if (!("outcomeDate" in payload)) {
        updateData.outcomeDate = new Date();
      }
    }
  }

  if ("outcomeDate" in payload) {
    const outcomeDate = toDateOrNull(payload.outcomeDate);
    if (outcomeDate !== undefined) updateData.outcomeDate = outcomeDate;
  }

  if ("outcomeNotes" in payload) {
    const notes = toStringOrNull(payload.outcomeNotes);
    if (notes !== undefined) updateData.outcomeNotes = notes;
  }

  if ("rescheduledDate" in payload) {
    const rescheduledDate = toDateOrNull(payload.rescheduledDate);
    if (rescheduledDate !== undefined) updateData.rescheduledDate = rescheduledDate;
  }

  if ("cancelledReason" in payload) {
    const cancelledReason = toStringOrNull(payload.cancelledReason);
    if (cancelledReason !== undefined) updateData.cancelledReason = cancelledReason;
  }

  const updated = await prismaWithInterview.visaInterview.update({
    where: { applicationId: params.id },
    data: updateData,
  });

  const auditFields: Array<keyof typeof updated> = [
    "isRequired",
    "location",
    "bookedDate",
    "outcome",
    "outcomeDate",
    "outcomeNotes",
    "rescheduledDate",
    "cancelledReason",
  ];

  const changed = auditFields.filter((field) => !sameValue(current[field], updated[field]));

  if (changed.length > 0) {
    await Promise.all(
      changed.map((field) =>
        db.activityLog.create({
          data: {
            userId: access.actor.id,
            entityType: "application",
            entityId: params.id,
            action: "visa_interview_updated",
            details: JSON.stringify({
              applicationId: params.id,
              field,
              from: current[field],
              to: updated[field],
              timestamp: new Date().toISOString(),
            }),
          },
        }),
      ),
    );
  }

  const notificationContext = await buildInterviewNotificationContext(params.id);
  if (notificationContext) {
    if (!current.isRequired && updated.isRequired) {
      await notifyInterviewRequired("VISA", notificationContext);
    }

    if (!sameValue(current.bookedDate, updated.bookedDate) && updated.bookedDate) {
      await notifyInterviewBooked("VISA", notificationContext, updated.bookedDate);
    }

    if (!sameValue(current.outcome, updated.outcome) && updated.outcome) {
      await notifyInterviewOutcome("VISA", notificationContext, updated.outcome, updated.rescheduledDate);
    }
  }

  const meta = await serializeRecord(updated);
  return NextResponse.json({ data: { ...updated, ...meta } });
}
