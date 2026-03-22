import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { randomBytes } from "crypto";

// POST /api/admin/settings/users/[id]/reset-password
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, isActive: true },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (!user.isActive)
    return NextResponse.json({ error: "Cannot reset password for an inactive account." }, { status: 400 });

  // Generate a 24-hour reset token
  const token = randomBytes(32).toString("hex");
  await db.$transaction(async (tx) => {
    // Invalidate any existing tokens for this user
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    await tx.passwordResetToken.create({
      data: { userId: id, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: "User",
        entityId: id,
        action: "PASSWORD_RESET_SENT",
        details: `Admin triggered password reset for ${user.email}.`,
      },
    });
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendMail({
    to: user.email,
    subject: "EduQuantica — Password Reset Request",
    text: [
      `Hi ${user.name ?? ""},`,
      "",
      "An administrator has initiated a password reset for your account.",
      "",
      "Use the link below to set a new password (expires in 24 hours):",
      `${base}/reset-password?token=${token}`,
      "",
      "If you did not expect this, please contact your administrator.",
      "",
      "The EduQuantica Team",
    ].join("\n"),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
