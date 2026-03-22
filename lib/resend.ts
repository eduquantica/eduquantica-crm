const RESEND_URL = "https://api.resend.com/emails";

export async function sendResendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "EduQuantica <no-reply@eduquantica.com>";
  if (!apiKey) {
    // Development fallback: log
    console.log(`\n[DEV] Email to ${to} - ${subject}\n${html}\n`);
    return;
  }

  await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });
}

export default sendResendEmail;
