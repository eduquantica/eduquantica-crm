import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "EduQuantica <info@eduquantica.com>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://eduquantica-crm.vercel.app";
const LOGO_URL = `${BASE_URL}/images/logo-white.png`;

// ─── Shared email shell ────────────────────────────────────────────────────────

function buildEmail({
  previewText,
  body,
}: {
  previewText: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>EduQuantica</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:#12264a;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <img src="${LOGO_URL}"
                   alt="EduQuantica"
                   width="180"
                   style="display:inline-block;max-width:180px;height:auto;border:0;" />
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 48px 32px;">
              ${body}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background-color:#f8fafc;border-radius:0 0 12px 12px;border-top:1px solid #e8edf2;padding:24px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">
                © ${new Date().getFullYear()} EduQuantica. All rights reserved.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated message — please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  const firstName = name.split(" ")[0] ?? name;

  const body = `
    <!-- Greeting -->
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#12264a;line-height:1.2;">
      Welcome, ${firstName}! 👋
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Your EduQuantica CRM account has been created. You're one step away from getting started.
    </p>

    <!-- Divider -->
    <hr style="border:none;border-top:2px solid #eef2f7;margin:0 0 28px;" />

    <!-- Instructions -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="width:40px;vertical-align:top;padding-top:2px;">
          <div style="width:28px;height:28px;border-radius:50%;background-color:#e8f0fe;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#2563eb;">1</div>
        </td>
        <td style="vertical-align:top;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">Click the button below</p>
          <p style="margin:0;font-size:13px;color:#64748b;">This will open a secure page to create your password.</p>
        </td>
      </tr>
      <tr><td colspan="2" style="height:16px;"></td></tr>
      <tr>
        <td style="width:40px;vertical-align:top;padding-top:2px;">
          <div style="width:28px;height:28px;border-radius:50%;background-color:#e8f0fe;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#2563eb;">2</div>
        </td>
        <td style="vertical-align:top;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">Set a strong password</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Use at least 8 characters with a mix of letters and numbers.</p>
        </td>
      </tr>
      <tr><td colspan="2" style="height:16px;"></td></tr>
      <tr>
        <td style="width:40px;vertical-align:top;padding-top:2px;">
          <div style="width:28px;height:28px;border-radius:50%;background-color:#e8f0fe;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#2563eb;">3</div>
        </td>
        <td style="vertical-align:top;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">Log in and get started</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Access your dashboard and start managing student applications.</p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="border-radius:8px;background-color:#f3a92d;">
          <a href="${setPasswordUrl}"
             style="display:inline-block;padding:15px 36px;font-size:16px;font-weight:700;color:#12264a;text-decoration:none;letter-spacing:0.02em;">
            Set My Password →
          </a>
        </td>
      </tr>
    </table>

    <!-- Expiry notice -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:8px;">
      <tr>
        <td style="background-color:#fff8ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
            ⏱ <strong>This link expires in 48 hours.</strong>
            If it expires, ask your administrator to send a new invite from the staff settings page.
          </p>
        </td>
      </tr>
    </table>

    <!-- Security note -->
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      If you were not expecting this invitation, you can safely ignore this email.
      No account will be activated without setting a password.
    </p>
  `;

  const html = buildEmail({
    previewText: `Welcome to EduQuantica! Set your password to get started.`,
    body,
  });

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Welcome to EduQuantica, ${firstName} — Set Your Password`,
    html,
    text: [
      `Welcome to EduQuantica CRM, ${name}!`,
      "",
      "Your account has been created. Set your password using the link below (expires in 48 hours):",
      "",
      setPasswordUrl,
      "",
      "Steps:",
      "1. Click the link above",
      "2. Set a strong password (min. 8 characters)",
      "3. Log in and get started",
      "",
      "If you were not expecting this invitation, you can safely ignore this email.",
      "",
      "— The EduQuantica Team",
    ].join("\n"),
  });
}

// ─── Password reset email ──────────────────────────────────────────────────────

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

  const body = `
    <!-- Heading -->
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#12264a;line-height:1.2;">
      Reset Your Password
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
      We received a request to reset the password for your EduQuantica account.
      Click the button below to choose a new password.
    </p>

    <!-- Divider -->
    <hr style="border:none;border-top:2px solid #eef2f7;margin:0 0 28px;" />

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="border-radius:8px;background-color:#f3a92d;">
          <a href="${resetUrl}"
             style="display:inline-block;padding:15px 36px;font-size:16px;font-weight:700;color:#12264a;text-decoration:none;letter-spacing:0.02em;">
            Reset Password →
          </a>
        </td>
      </tr>
    </table>

    <!-- Expiry + security notices -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
      <tr>
        <td style="background-color:#fff8ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
            ⏱ <strong>This link expires in 1 hour.</strong>
            After that, you will need to request a new reset link.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;">
            🔒 If you did <strong>not</strong> request this reset, your account is safe.
            Simply ignore this email — your password will not change.
          </p>
        </td>
      </tr>
    </table>

    <!-- Button fallback link -->
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
      Button not working? Copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${resetUrl}</a>
    </p>
  `;

  const html = buildEmail({
    previewText: "Reset your EduQuantica password — link expires in 1 hour.",
    body,
  });

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Reset Your EduQuantica Password",
    html,
    text: [
      "Reset Your EduQuantica Password",
      "",
      "Click the link below to choose a new password (expires in 1 hour):",
      "",
      resetUrl,
      "",
      "If you did not request this reset, ignore this email — your password will not change.",
      "",
      "— The EduQuantica Team",
    ].join("\n"),
  });
}
