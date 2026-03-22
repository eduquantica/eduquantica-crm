import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { randomBytes } from "crypto";
import { z } from "zod";

// Roles that staff accounts cannot be assigned — they self-register via public pages
const EXCLUDED_ROLES = ["STUDENT", "SUB_AGENT"];

const createSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),
  roleId: z.string().min(1, "Role is required"),
});

function adminGuard(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.roleName !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET /api/admin/settings/users
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const roleId = searchParams.get("roleId") ?? "";
  const role = searchParams.get("role") ?? ""; // e.g., "COUNSELLOR"
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(role ? { role: { name: role } } : { role: { name: { notIn: EXCLUDED_ROLES } } }),
    isActive: true,
    ...(roleId ? { roleId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, label: true, isBuiltIn: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ data: { users, total, page, totalPages: Math.ceil(total / limit) } });
}

// POST /api/admin/settings/users
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // Validate role is not excluded
    const role = await db.role.findUnique({
      where: { id: data.roleId },
      select: { id: true, name: true },
    });
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    if (EXCLUDED_ROLES.includes(role.name))
      return NextResponse.json({ error: "Cannot create staff account with this role." }, { status: 400 });

    // Email uniqueness check
    const existing = await db.user.findFirst({
      where: { email: { equals: data.email.toLowerCase(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "Email already in use." }, { status: 409 });

    // Create user with no password — they set it via the email link
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          password: null,
          roleId: data.roleId,
        },
        select: { id: true, email: true, name: true },
      });

      await tx.activityLog.create({
        data: {
          userId: session!.user.id,
          entityType: "User",
          entityId: created.id,
          action: "CREATED",
          details: `Staff account created for ${data.email} with role ${role.name}.`,
        },
      });

      return created;
    });

    // Generate set-password token (48 h)
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) },
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    await sendMail({
      to: user.email,
      subject: "Welcome to EduQuantica CRM — Set Your Password",
      text: [
        `Hi ${user.name ?? ""},`,
        "",
        "An EduQuantica CRM account has been created for you.",
        "",
        "Please set your password using the link below (expires in 48 hours):",
        `${base}/reset-password?token=${token}`,
        "",
        "The EduQuantica Team",
      ].join("\n"),
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    console.error("[settings/users POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
