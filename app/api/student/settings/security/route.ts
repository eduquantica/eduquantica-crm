import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const changePasswordSchema = z.object({
  action: z.literal("changePassword"),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const twoFactorSchema = z.object({
  action: z.literal("toggleTwoFactor"),
  enabled: z.boolean(),
});

const deletionSchema = z.object({
  action: z.literal("requestDeletion"),
  reason: z.string().trim().min(5),
});

const payloadSchema = z.union([changePasswordSchema, twoFactorSchema, deletionSchema]);

async function getStudentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user.roleName !== "STUDENT" && session.user.roleName !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      password: true,
      twoFactorEnabled: true,
      twoFactorEnabledAt: true,
      student: {
        select: {
          id: true,
          preferences: {
            select: {
              accountDeletionRequestedAt: true,
              accountDeletionReason: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.student) {
    return { error: NextResponse.json({ error: "Student account not found" }, { status: 404 }) } as const;
  }

  return { user } as const;
}

export async function GET() {
  const ctx = await getStudentUser();
  if ("error" in ctx) return ctx.error;

  return NextResponse.json({
    data: {
      twoFactorEnabled: ctx.user.twoFactorEnabled,
      twoFactorEnabledAt: ctx.user.twoFactorEnabledAt,
      accountDeletionRequestedAt: ctx.user.student?.preferences?.accountDeletionRequestedAt || null,
      accountDeletionReason: ctx.user.student?.preferences?.accountDeletionReason || "",
    },
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getStudentUser();
  if ("error" in ctx) return ctx.error;

  try {
    const payload = payloadSchema.parse(await req.json());

    if (payload.action === "changePassword") {
      if (!ctx.user.password) {
        return NextResponse.json({ error: "Password login is not configured for this account" }, { status: 400 });
      }

      const ok = await bcrypt.compare(payload.currentPassword, ctx.user.password);
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      if (payload.currentPassword === payload.newPassword) {
        return NextResponse.json({ error: "New password must be different" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(payload.newPassword, 12);
      await db.user.update({
        where: { id: ctx.user.id },
        data: { password: hashed },
      });

      await db.activityLog.create({
        data: {
          userId: ctx.user.id,
          entityType: "security",
          entityId: ctx.user.id,
          action: "password_changed",
          details: "Student changed account password",
        },
      }).catch(() => undefined);

      return NextResponse.json({ data: { ok: true } });
    }

    if (payload.action === "toggleTwoFactor") {
      await db.user.update({
        where: { id: ctx.user.id },
        data: {
          twoFactorEnabled: payload.enabled,
          twoFactorEnabledAt: payload.enabled ? new Date() : null,
        },
      });

      await db.activityLog.create({
        data: {
          userId: ctx.user.id,
          entityType: "security",
          entityId: ctx.user.id,
          action: payload.enabled ? "two_factor_enabled" : "two_factor_disabled",
          details: `2FA ${payload.enabled ? "enabled" : "disabled"}`,
        },
      }).catch(() => undefined);

      return NextResponse.json({ data: { ok: true, twoFactorEnabled: payload.enabled } });
    }

    const studentId = ctx.user.student?.id;
    if (!studentId) {
      return NextResponse.json({ error: "Student account not found" }, { status: 404 });
    }

    await db.studentPreferences.upsert({
      where: { studentId },
      update: {
        accountDeletionRequestedAt: new Date(),
        accountDeletionReason: payload.reason,
      },
      create: {
        studentId,
        preferredDestinations: [],
        preferredLevels: [],
        preferredFields: [],
        accountDeletionRequestedAt: new Date(),
        accountDeletionReason: payload.reason,
      },
    });

    await db.activityLog.create({
      data: {
        userId: ctx.user.id,
        entityType: "student",
          entityId: studentId,
        action: "deletion_requested",
        details: payload.reason,
      },
    }).catch(() => undefined);

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    console.error("[/api/student/settings/security PATCH]", error);
    return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 });
  }
}
