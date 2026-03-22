import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function staffGuard(session: any) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (session as any).user.roleName;
  if (r === "STUDENT" || r === "SUB_AGENT" || r === "BRANCH_MANAGER" || r === "SUB_AGENT_COUNSELLOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const updateUniversitySchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  type: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  qsRanking: z.number().int().positive().optional().nullable(),
  timesHigherRanking: z.number().int().positive().optional().nullable(),
  website: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  foundedYear: z.number().int().optional().nullable(),
  dliNumber: z.string().optional().nullable(),
  applicationFee: z.number().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  currency: z.string().optional(),
  logo: z.string().optional().nullable(),
  campusPhotos: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  postStudyWorkVisa: z.string().optional().nullable(),
  commissionAgreement: z
    .object({
      commissionRate: z.number().min(0).max(30, "University commission rate cannot exceed 30%"),
      agreedDate: z.string().datetime().optional().nullable(),
      validUntil: z.string().datetime().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .optional(),
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const university = await db.university.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        type: true,
        qsRanking: true,
        timesHigherRanking: true,
        website: true,
        logo: true,
        description: true,
        foundedYear: true,
        dliNumber: true,
        applicationFee: true,
        currency: true,
        isActive: true,
        contactPerson: true,
        contactEmail: true,
        campusPhotos: true,
        postStudyWorkVisa: true,
        courses: {
          select: {
            id: true,
            name: true,
            level: true,
            tuitionFee: true,
            currency: true,
          },
          orderBy: { name: "asc" },
        },
        scholarships: { select: { id: true, name: true, amount: true, isActive: true } },
        commissionAgreement: {
          select: {
            id: true,
            commissionRate: true,
            currency: true,
            agreedDate: true,
            validUntil: true,
            notes: true,
            isActive: true,
            createdAt: true,
            createdBy: true,
          },
        },
      },
    });

    if (!university) {
      return NextResponse.json({ error: "University not found" }, { status: 404 });
    }

    const commissionHistory = await db.activityLog.findMany({
      where: {
        entityType: "university_commission_agreement",
        entityId: params.id,
        action: "commission_agreement_updated",
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: { university, commissionHistory } });
  } catch (e) {
    console.error("[/api/admin/universities/[id] GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = staffGuard(session);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = updateUniversitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { commissionAgreement, ...universityPayload } = parsed.data;

    const existingAgreement = await db.universityCommissionAgreement.findUnique({
      where: { universityId: params.id },
      select: { commissionRate: true, agreedDate: true, validUntil: true, notes: true },
    });

    const university = await db.university.update({
      where: { id: params.id },
      data: universityPayload,
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        type: true,
        qsRanking: true,
        timesHigherRanking: true,
        website: true,
        logo: true,
        description: true,
        foundedYear: true,
        dliNumber: true,
        applicationFee: true,
        currency: true,
        isActive: true,
        contactPerson: true,
        contactEmail: true,
        campusPhotos: true,
        postStudyWorkVisa: true,
      },
    });

    if (commissionAgreement) {
      if (commissionAgreement.commissionRate > 30) {
        return NextResponse.json({ error: "University commission rate cannot exceed 30%" }, { status: 400 });
      }

      await db.universityCommissionAgreement.upsert({
        where: { universityId: params.id },
        create: {
          universityId: params.id,
          commissionRate: commissionAgreement.commissionRate,
          currency: university.currency,
          agreedDate: commissionAgreement.agreedDate ? new Date(commissionAgreement.agreedDate) : null,
          validUntil: commissionAgreement.validUntil ? new Date(commissionAgreement.validUntil) : null,
          notes: commissionAgreement.notes ?? null,
          isActive: true,
          createdBy: session!.user.id,
        },
        update: {
          commissionRate: commissionAgreement.commissionRate,
          currency: university.currency,
          agreedDate: commissionAgreement.agreedDate ? new Date(commissionAgreement.agreedDate) : null,
          validUntil: commissionAgreement.validUntil ? new Date(commissionAgreement.validUntil) : null,
          notes: commissionAgreement.notes ?? null,
          isActive: true,
        },
      });

      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "university_commission_agreement",
          entityId: params.id,
          action: "commission_agreement_updated",
          details: JSON.stringify({
            previous: existingAgreement,
            next: {
              commissionRate: commissionAgreement.commissionRate,
              agreedDate: commissionAgreement.agreedDate,
              validUntil: commissionAgreement.validUntil,
              notes: commissionAgreement.notes,
            },
          }),
        },
      });
    }

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "university",
          entityId: university.id,
          action: "updated",
          details: `Updated university: ${university.name}`,
        },
      });
    } catch (err) {
      console.error("Failed to log activity", err);
    }

    return NextResponse.json({ data: { university } });
  } catch (e) {
    console.error("[/api/admin/universities/[id] PUT]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
