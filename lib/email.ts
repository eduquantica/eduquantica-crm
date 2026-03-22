import nodemailer from "nodemailer";

// ─── Transport ────────────────────────────────────────────────────────────────

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } =
    process.env;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: SMTP_SECURE === "true", // true for port 465
    auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });
}

const FROM = process.env.SMTP_FROM ?? "EduQuantica <noreply@eduquantica.com>";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

// ─── Generic send ─────────────────────────────────────────────────────────────

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail({ to, subject, text, html }: MailOptions): Promise<void> {
  if (!isSmtpConfigured()) {
    console.log(`\n[DEV] Email to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await getTransporter().sendMail({ from: FROM, to, subject, text, html });
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    // Development fallback — print the link to the console
    console.log(
      "\n─────────────────────────────────────────────────────────\n" +
        "[DEV] SMTP not configured. Password reset link:\n" +
        resetUrl +
        "\n─────────────────────────────────────────────────────────\n",
    );
    return;
  }

  await getTransporter().sendMail({
    from: FROM,
    to: toEmail,
    subject: "Reset your EduQuantica password",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:24px;">
          <div style="height:36px;width:36px;border-radius:8px;background:#e5edff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">EQ</div>
          <div style="font-size:18px;font-weight:700;color:#1f2937;">EduQuantica</div>
        </div>
        <h2 style="margin-top:0;font-size:22px;">Reset your password</h2>
        <p style="color:#555;line-height:1.6;">
          We received a request to reset the password for your EduQuantica account.
          Click the button below to choose a new password. This link expires in
          <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#2563eb;
                  color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px;">
          If you didn't request this, you can safely ignore this email.
          Your password will not change.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;">
          EduQuantica CRM &middot; This is an automated message, please do not reply.
        </p>
      </div>
    `,
    text: `Reset your EduQuantica password\n\nClick the link below (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}
