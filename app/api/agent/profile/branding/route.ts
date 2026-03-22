import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  agencyName: z.string().min(1),
  brandingLogoUrl: z.string().optional().nullable(),
  brandingPrimaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  brandingContactEmail: z.string().email().optional().or(z.literal("")),
  brandingContactPhone: z.string().optional(),
  brandingWebsite: z.string().url().optional().or(z.literal("")),
  brandingFacebook: z.string().optional(),
  brandingInstagram: z.string().optional(),
  brandingLinkedIn: z.string().optional(),
  brandingWhatsapp: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      agencyName: true,
      brandingLogoUrl: true,
      brandingPrimaryColor: true,
      brandingContactEmail: true,
      brandingContactPhone: true,
      brandingWebsite: true,
      brandingFacebook: true,
      brandingInstagram: true,
      brandingLinkedIn: true,
      brandingWhatsapp: true,
      referralCode: true,
      _count: { select: { referredStudents: true } },
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  let referralCode = subAgent.referralCode;
  if (!referralCode) {
    referralCode = `AG${subAgent.id.slice(-6).toUpperCase()}`;
    try {
      await db.subAgent.update({ where: { id: subAgent.id }, data: { referralCode } });
    } catch {
      referralCode = `${referralCode}${Math.floor(Math.random() * 90 + 10)}`;
      await db.subAgent.update({ where: { id: subAgent.id }, data: { referralCode } });
    }
  }

  return NextResponse.json({ data: { ...subAgent, referralCode } });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  const updated = await db.subAgent.update({
    where: { userId: session.user.id },
    data: {
      agencyName: body.agencyName,
      brandingLogoUrl: body.brandingLogoUrl || null,
      brandingPrimaryColor: body.brandingPrimaryColor,
      brandingContactEmail: body.brandingContactEmail || null,
      brandingContactPhone: body.brandingContactPhone || null,
      brandingWebsite: body.brandingWebsite || null,
      brandingFacebook: body.brandingFacebook || null,
      brandingInstagram: body.brandingInstagram || null,
      brandingLinkedIn: body.brandingLinkedIn || null,
      brandingWhatsapp: body.brandingWhatsapp || null,
    },
  });

  await db.activityLog.create({
    data: {
      userId: session.user.id,
      entityType: "sub_agent_branding",
      entityId: updated.id,
      action: "updated",
      details: "Updated branding profile",
    },
  });

  return NextResponse.json({ data: updated });
}
