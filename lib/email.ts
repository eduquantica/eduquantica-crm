import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "EduQuantica <info@eduquantica.com>";

// ─── Shared HTML wrapper ───────────────────────────────────────────────────────

function emailShell(body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;">
        <div style="height:36px;width:36px;border-radius:8px;background:#12264a;color:#f3c96a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;letter-spacing:0.05em;">EQ</div>
        <div style="font-size:18px;font-weight:700;color:#12264a;">EduQuantica</div>
      </div>
      ${body}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0;" />
      <p style="color:#aaa;font-size:12px;margin:0;">EduQuantica CRM &middot; This is an automated message, please do not reply.</p>
    </div>
  `;
}

// ─── Generic send ─────────────────────────────────────────────────────────────

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail({ to, subject, text, html }: MailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Email to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, text, html });
}

// ─── Welcome / set-password email ─────────────────────────────────────────────

export async function sendWelcomeEmail(
  toEmail: string,
  name: string,
  setPasswordUrl: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      "\n─────────────────────────────────────────────────────────\n" +
        `[DEV] No RESEND_API_KEY. Welcome invite link for ${toEmail}:\n` +
        setPasswordUrl +
        "\n─────────────────────────────────────────────────────────\n",
    );
    return;
  }

  const html = emailShell(`
    <h2 style="margin:0 0 12px;font-size:22px;color:#12264a;">Welcome, ${name}!</h2>
    <p style="color:#555;line-height:1.6;margin:0 0 20px;">
      An EduQuantica CRM account has been created for you.
      Click the button below to set your password and get started.
      This link expires in <strong>48 hours</strong>.
    </p>
    <a href="${setPasswordUrl}"
       style="display:inline-block;padding:13px 30px;background:#2563eb;color:#fff;
              text-decoration:none;border-radius:7px;font-weight:600;font-size:15px;">
      Set My Password
    </a>
    <p style="color:#888;font-size:13px;margin-top:24px;">
      If you were not expecting this invitation, you can safely ignore this email.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Welcome to EduQuantica CRM — Set Your Password",
    html,
    text: [
      `Welcome to EduQuantica CRM, ${name}!`,
      "",
      "An account has been created for you. Set your password using the link below (expires in 48 hours):",
      setPasswordUrl,
      "",
      "If you were not expecting this invitation, you can safely ignore this email.",
      "",
      "The EduQuantica Team",
    ].join("\n"),
  });
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      "\n─────────────────────────────────────────────────────────\n" +
        "[DEV] No RESEND_API_KEY. Password reset link:\n" +
        resetUrl +
        "\n─────────────────────────────────────────────────────────\n",
    );
    return;
  }

  const html = emailShell(`
    <h2 style="margin:0 0 12px;font-size:22px;color:#12264a;">Reset your password</h2>
    <p style="color:#555;line-height:1.6;margin:0 0 20px;">
      We received a request to reset the password for your EduQuantica account.
      Click the button below to choose a new password. This link expires in
      <strong>1 hour</strong>.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;padding:13px 30px;background:#2563eb;color:#fff;
              text-decoration:none;border-radius:7px;font-weight:600;font-size:15px;">
      Reset Password
    </a>
    <p style="color:#888;font-size:13px;margin-top:24px;">
      If you didn't request this, you can safely ignore this email.
      Your password will not change.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Reset your EduQuantica password",
    html,
    text: `Reset your EduQuantica password\n\nClick the link below (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}
