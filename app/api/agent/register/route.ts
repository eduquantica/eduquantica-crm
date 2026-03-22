import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { NotificationService } from "@/lib/notifications";

const schema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    dialCode: z.string().min(1),
    phone: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    agencyName: z.string().min(1),
    country: z.string().min(1),
    city: z.string().min(1),
    website: z.string().optional().or(z.literal("")),
    agreed: z.boolean(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((d) => d.agreed === true, {
    path: ["agreed"],
    message: "You must agree to the terms",
  });

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const exists = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const role = await db.role.findUnique({ where: { name: "SUB_AGENT" }, select: { id: true } });
    if (!role) {
      return NextResponse.json({ error: "Sub-agent role not configured." }, { status: 500 });
    }

    const hashed = await bcrypt.hash(body.password, 12);

    const createdUserId = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashed,
          name: `${body.firstName} ${body.lastName}`,
          phone: `${body.dialCode} ${body.phone}`,
          roleId: role.id,
        },
      });

      const subAgent = await tx.subAgent.create({
        data: {
          userId: user.id,
          agencyName: body.agencyName,
          firstName: body.firstName,
          lastName: body.lastName,
          businessEmail: email,
          primaryDialCode: body.dialCode,
          phone: body.phone,
          agencyCountry: body.country,
          agencyCity: body.city,
          website: body.website?.trim() || null,
          approvalStatus: "PENDING",
          isApproved: false,
          commissionRate: 80,
        },
      });

      await tx.subAgentAgreement.upsert({
        where: { subAgentId: subAgent.id },
        create: {
          subAgentId: subAgent.id,
          currentTier: "STANDARD",
          currentRate: 80,
          isActive: false,
        },
        update: {
          currentTier: "STANDARD",
          currentRate: 80,
        },
      });

      return user.id;
    });

    const adminEmail = process.env.ADMIN_INBOX_EMAIL || "admin@eduquantica.com";
    await sendResendEmail({
      to: adminEmail,
      subject: `New sub-agent application from ${body.agencyName} - ${body.country}`,
      html: `<p>New sub-agent application received.</p><p><strong>Agency:</strong> ${body.agencyName}<br/><strong>Country:</strong> ${body.country}<br/><strong>Contact:</strong> ${body.firstName} ${body.lastName} (${email})</p>`,
    });

    const adminUsers = await db.user.findMany({
      where: { role: { name: { in: ["ADMIN", "MANAGER"] } }, isActive: true },
      select: { id: true },
    });

    await Promise.all(
      adminUsers.map((admin) =>
        NotificationService.createNotification({
          userId: admin.id,
          type: "SUB_AGENT_APPLICATION_SUBMITTED",
          message: `New sub-agent application from ${body.agencyName}.`,
          linkUrl: "/dashboard/sub-agents/applications",
          actorUserId: createdUserId,
        }).catch(() => undefined),
      ),
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("[agent-register]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
