import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { deriveTrainingStatus } from "@/lib/training";

function ensureTrainingViewer(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

const updateSchema = z.object({
  action: z.enum(["edit", "renew"]),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  deliveredBy: z.string().optional().nullable(),
  trainingDate: z.string().optional().nullable(),
  completionDate: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurringMonths: z.number().int().min(1).max(36).optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { recordId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;

  const existing = await db.trainingRecord.findUnique({
    where: { id: params.recordId },
    include: {
      training: true,
    },
  });

  if (!existing) return NextResponse.json({ error: "Training record not found" }, { status: 404 });

  const completionDate = payload.completionDate ? new Date(payload.completionDate) : existing.completionDate;
  const expiryDate = payload.expiryDate === undefined
    ? existing.expiryDate
    : payload.expiryDate
      ? new Date(payload.expiryDate)
      : null;

  if (Number.isNaN(completionDate.getTime())) return NextResponse.json({ error: "Invalid completion date" }, { status: 400 });
  if (expiryDate && Number.isNaN(expiryDate.getTime())) return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });

  if (payload.action === "edit") {
    const status = deriveTrainingStatus(expiryDate);

    const updated = await db.$transaction(async (tx) => {
      await tx.training.update({
        where: { id: existing.trainingId },
        data: {
          ...(payload.name !== undefined ? { name: payload.name || existing.training.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description || null } : {}),
          ...(payload.deliveredBy !== undefined ? { deliveredBy: payload.deliveredBy || null } : {}),
          ...(payload.trainingDate !== undefined
            ? { trainingDate: payload.trainingDate ? new Date(payload.trainingDate) : null }
            : {}),
          ...(payload.isRecurring !== undefined ? { isRecurring: payload.isRecurring } : {}),
          ...(payload.recurringMonths !== undefined ? { recurringMonths: payload.recurringMonths || null } : {}),
          expiryDate,
        },
      });

      return tx.trainingRecord.update({
        where: { id: params.recordId },
        data: {
          completionDate,
          expiryDate,
          certificateUrl: payload.certificateUrl === undefined ? existing.certificateUrl : payload.certificateUrl || null,
          notes: payload.notes === undefined ? existing.notes : payload.notes || null,
          status,
        },
      });
    });

    return NextResponse.json({ ok: true, data: updated });
  }

  const renewed = await db.$transaction(async (tx) => {
    await tx.trainingRecord.update({
      where: { id: params.recordId },
      data: { status: "RENEWED" },
    });

    await tx.training.update({
      where: { id: existing.trainingId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name || existing.training.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description || null } : {}),
        ...(payload.deliveredBy !== undefined ? { deliveredBy: payload.deliveredBy || null } : {}),
        ...(payload.trainingDate !== undefined
          ? { trainingDate: payload.trainingDate ? new Date(payload.trainingDate) : null }
          : {}),
        ...(payload.isRecurring !== undefined ? { isRecurring: payload.isRecurring } : {}),
        ...(payload.recurringMonths !== undefined ? { recurringMonths: payload.recurringMonths || null } : {}),
        expiryDate,
      },
    });

    return tx.trainingRecord.create({
      data: {
        trainingId: existing.trainingId,
        userId: existing.userId,
        completionDate,
        expiryDate,
        certificateUrl: payload.certificateUrl === undefined ? existing.certificateUrl : payload.certificateUrl || null,
        notes: payload.notes === undefined ? existing.notes : payload.notes || null,
        status: deriveTrainingStatus(expiryDate),
      },
    });
  });

  return NextResponse.json({ ok: true, data: renewed });
}

export async function DELETE(_req: NextRequest, { params }: { params: { recordId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.trainingRecord.findUnique({
    where: { id: params.recordId },
    select: { id: true, trainingId: true },
  });

  if (!existing) return NextResponse.json({ error: "Training record not found" }, { status: 404 });

  await db.$transaction(async (tx) => {
    await tx.trainingRecord.delete({ where: { id: params.recordId } });
    const remaining = await tx.trainingRecord.count({ where: { trainingId: existing.trainingId } });
    if (remaining === 0) {
      await tx.training.delete({ where: { id: existing.trainingId } });
    }
  });

  return NextResponse.json({ ok: true });
}
