import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { deriveTrainingStatus, EDUQUANTICA_ORG_ID, EDUQUANTICA_ORG_TYPE } from "@/lib/training";
import { z } from "zod";

function ensureTrainingViewer(roleName?: string) {
  return roleName === "ADMIN" || roleName === "MANAGER";
}

const createSchema = z.object({
  name: z.string().min(1),
  completionDate: z.string().min(1),
  expiryDate: z.string().optional().nullable(),
  deliveredBy: z.string().optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await db.trainingRecord.findMany({
    where: { userId: params.id, training: { organisationType: EDUQUANTICA_ORG_TYPE } },
    include: { training: true },
    orderBy: [{ expiryDate: "asc" }, { completionDate: "desc" }],
  });

  return NextResponse.json({ data: records });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ensureTrainingViewer(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;

  const completionDate = new Date(payload.completionDate);
  const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null;
  if (Number.isNaN(completionDate.getTime())) {
    return NextResponse.json({ error: "Invalid completion date" }, { status: 400 });
  }

  const status = deriveTrainingStatus(expiryDate);

  const created = await db.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        organisationId: EDUQUANTICA_ORG_ID,
        organisationType: EDUQUANTICA_ORG_TYPE,
        name: payload.name,
        deliveredBy: payload.deliveredBy || null,
        expiryDate,
        createdBy: session.user.id,
      },
    });

    return tx.trainingRecord.create({
      data: {
        trainingId: training.id,
        userId: params.id,
        completionDate,
        expiryDate,
        certificateUrl: payload.certificateUrl || null,
        notes: payload.notes || null,
        status,
      },
      include: { training: true },
    });
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}
