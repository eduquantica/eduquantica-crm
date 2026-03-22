import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs/promises";
import { NotificationService } from "@/lib/notifications";

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

function pickString(formData: FormData, keys: string[]): string {
  for (const k of keys) {
    const v = formData.get(k);
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return "";
}

function pickFile(formData: FormData, keys: string[]): File | null {
  for (const k of keys) {
    const v = formData.get(k);
    if (v instanceof File) return v;
  }
  return null;
}

async function ensureUploadsDir() {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

async function saveOptionalFile(file: File | null): Promise<string | null> {
  if (!file) return null;
  if (!file.name) return null;

  const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) return null;

  const uploadDir = await ensureUploadsDir();
  const bytes = Buffer.from(await file.arrayBuffer());

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const unique = `${Date.now()}-${randomBytes(6).toString("hex")}-${safeName}`;
  const fullPath = path.join(uploadDir, unique);

  await fs.writeFile(fullPath, bytes);

  return `/api/files/${encodeURIComponent(unique)}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Accept multiple possible frontend field names (aliases)
    const businessName = pickString(formData, ["businessName", "agencyName"]);
    const roleAtAgency = pickString(formData, ["roleAtAgency", "agencyRole"]);

    const firstName = pickString(formData, ["firstName"]);
    const lastName = pickString(formData, ["lastName"]);

    const emailRaw = pickString(formData, ["email", "businessEmail"]);
    const email = emailRaw.toLowerCase();

    const dialCode = pickString(formData, ["dialCode", "primaryDialCode", "phoneDialCode"]);
    const phoneNumber = pickString(formData, ["phoneNumber", "primaryContactNumber", "phone"]);

    const country = pickString(formData, ["country", "agencyCountry"]);
    const city = pickString(formData, ["city", "agencyCity"]);

    const website = pickString(formData, ["website", "agencyWebsite"]);
    const expectedMonthlySubmissions = pickString(formData, [
      "expectedMonthlySubmissions",
      "expectedMonthlyStudentSubmissions",
    ]);

    const heardAboutUs = pickString(formData, ["heardAboutUs", "howDidYouHearAboutUs"]);

    const docFile = pickFile(formData, [
      "document",
      "registrationDocument",
      "agencyRegistrationDocument",
      "attachment",
    ]);

    // Validate required fields (and return which ones are missing)
    const missing: string[] = [];
    if (!businessName) missing.push("businessName");
    if (!roleAtAgency) missing.push("roleAtAgency");
    if (!firstName) missing.push("firstName");
    if (!lastName) missing.push("lastName");
    if (!email) missing.push("email");
    if (!dialCode) missing.push("dialCode");
    if (!phoneNumber) missing.push("phoneNumber");
    if (!country) missing.push("country");
    if (!city) missing.push("city");
    if (!expectedMonthlySubmissions) missing.push("expectedMonthlySubmissions");
    if (!heardAboutUs) missing.push("heardAboutUs");

    if (missing.length) {
      return jsonError("Missing required fields.", 400, { missing });
    }

    // Find SUB_AGENT role
    const role = await db.role.findUnique({
      where: { name: "SUB_AGENT" },
      select: { id: true },
    });

    if (!role?.id) {
      return jsonError(
        'SUB_AGENT role not found. Run seed to create built-in roles.',
        500
      );
    }

    // Email uniqueness check (case-insensitive)
    const existing = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Optional upload
    const documentUrl = await saveOptionalFile(docFile);

    // Create user + subAgent atomically
    const created = await db.$transaction(async (tx: TxClient) => {
      const user = await tx.user.create({
        data: {
          email,
          password: null, // NO password at apply stage
          name: `${firstName} ${lastName}`,
          roleId: role.id,
        },
        select: { id: true, email: true },
      });

      const subAgent = await tx.subAgent.create({
        data: {
          userId: user.id,

          // Keep BOTH sets if your schema contains them.
          // If your SubAgent model doesn’t have some fields, Prisma will error (tell me and I’ll align it).
          agencyName: businessName,
          firstName,
          lastName,
          roleAtAgency,
          businessEmail: email,
          primaryDialCode: dialCode,
          phone: phoneNumber,
          agencyCountry: country,
          agencyCity: city,
          website: website || null,
          expectedMonthlySubmissions,
          heardAboutUs,

          isApproved: false,
          approvalStatus: "PENDING",

          registrationDocUrl: documentUrl,
        },
        select: { id: true },
      });

      return { user, subAgent };
    });

    // Emails (best-effort)
    try {
      await sendMail({
        to: email,
        subject: "EduQuantica — Application received",
        text:
          "Your application has been received. We will review it within 2-3 business days.",
      });

      await sendMail({
        to: process.env.ADMIN_INBOX_EMAIL || "admin@eduquantica.com",
        subject: "New sub-agent application",
        text: `New sub-agent application from ${firstName} ${lastName} at ${businessName}. Email: ${email}`,
      });
    } catch {
      // ignore email errors in dev
    }

    const adminUsers = await db.user.findMany({
      where: { role: { name: { in: ["ADMIN", "MANAGER"] } }, isActive: true },
      select: { id: true },
    });

    await Promise.all(
      adminUsers.map((admin) =>
        NotificationService.createNotification({
          userId: admin.id,
          type: "SUB_AGENT_APPLICATION_SUBMITTED",
          message: `New sub-agent application from ${businessName}.`,
          linkUrl: "/dashboard/sub-agents/applications",
          actorUserId: created.user.id,
        }).catch(() => undefined),
      ),
    );

    const redirectUrl = `/agent/pending?email=${encodeURIComponent(email)}`;
    return NextResponse.json(
      { ok: true, id: created.subAgent.id, redirectUrl },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}