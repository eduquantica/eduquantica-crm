import type { ApplicationStatus, VisaSubStatus } from "@prisma/client";

function layout(htmlBody: string) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>EduQuantica</title>
    </head>
    <body style="font-family: system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial; margin:0; padding:0; background:#f7fafc;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:24px 0; text-align:center;">
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff; border-radius:8px; overflow:hidden;">
              <tr>
                <td style="background:#1B2A4A; padding:20px; color:#fff;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div style="height:36px; min-width:36px; border-radius:8px; background:#F5A623; color:#1B2A4A; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">EQ</div>
                    <h1 style="font-size:18px; margin:0;">EduQuantica</h1>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px; color:#111;">
                  ${htmlBody}
                </td>
              </tr>
              <tr>
                <td style="background:#f1f5f9; padding:16px; color:#6b7280; font-size:13px; text-align:center;">
                  <div>Contact us: support@eduquantica.com • +44 20 0000 0000</div>
                  <div style="margin-top:6px;">EduQuantica &middot; Helping students succeed</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function statusTitle(status: ApplicationStatus, visaSubStatus?: VisaSubStatus) {
  if (status === "APPLIED") return "Application Submitted";
  if (status === "DOCUMENTS_PENDING") return "Documents Requested";
  if (status === "DOCUMENTS_SUBMITTED") return "Documents Verified";
  if (status === "SUBMITTED_TO_UNIVERSITY") return "Submitted to University";
  if (status === "CONDITIONAL_OFFER") return "Conditional Offer Received";
  if (status === "UNCONDITIONAL_OFFER") return "Unconditional Offer Received";
  if (status === "FINANCE_IN_PROGRESS") return "Finance Started";
  if (status === "DEPOSIT_PAID") return "Deposit Confirmed";
  if (status === "FINANCE_COMPLETE") return "Finance Complete";
  if (status === "CAS_ISSUED") return "CAS Issued";
  if (status === "VISA_APPLIED" && visaSubStatus === "VISA_APPROVED") return "Visa Approved";
  if (status === "VISA_APPLIED" && visaSubStatus === "VISA_REJECTED") return "Visa Update";
  if (status === "VISA_APPLIED") return "Visa Application Submitted";
  if (status === "ENROLLED") return "Enrolment Confirmed";
  return "Application Withdrawn";
}

function statusBody(status: ApplicationStatus, opts: {
  studentName: string;
  courseName: string;
  universityName: string;
  counsellorName?: string;
  visaSubStatus?: VisaSubStatus;
  offerConditions?: string;
  casNumber?: string;
  withdrawalReason?: string;
}) {
  const counsellor = opts.counsellorName || "your counsellor";

  if (status === "APPLIED") {
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Welcome to EduQuantica. Your application has been submitted successfully for <strong>${escapeHtml(opts.courseName)}</strong> at <strong>${escapeHtml(opts.universityName)}</strong>.</p><p>Next step: ${escapeHtml(counsellor)} will review your details and guide you through document collection.</p>`;
  }

  if (status === "DOCUMENTS_PENDING") {
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Action required: please upload your required documents in your student portal.</p><p>Next step: once documents are verified, we will proceed to university submission.</p>`;
  }

  if (status === "DOCUMENTS_SUBMITTED") {
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Great news - your documents have been received and verified.</p><p>Next step: your counsellor will submit your application to the university.</p>`;
  }

  if (status === "SUBMITTED_TO_UNIVERSITY") {
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Great news - your application has been submitted to <strong>${escapeHtml(opts.universityName)}</strong>.</p><p>Next step: we are waiting for the university decision.</p>`;
  }

  if (status === "CONDITIONAL_OFFER") {
    return `<p>Congratulations ${escapeHtml(opts.studentName)}!</p><p>You have received a conditional offer for <strong>${escapeHtml(opts.courseName)}</strong> at <strong>${escapeHtml(opts.universityName)}</strong>.</p><p><strong>Conditions:</strong> ${escapeHtml(opts.offerConditions || "Please review conditions in your portal.")}</p><p>Next step: complete the listed conditions to progress.</p>`;
  }

  if (status === "UNCONDITIONAL_OFFER") {
    return `<p>Excellent news ${escapeHtml(opts.studentName)}!</p><p>You have received an unconditional offer for <strong>${escapeHtml(opts.courseName)}</strong> at <strong>${escapeHtml(opts.universityName)}</strong>.</p><p>Next step: complete your finance section and upload required financial documents.</p>`;
  }

  if (status === "FINANCE_COMPLETE") {
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Your finance stage is complete.</p><p>Next step: your CAS is now being prepared.</p>`;
  }

  if (status === "CAS_ISSUED") {
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Your CAS has been issued.</p><p><strong>CAS Number:</strong> ${escapeHtml(opts.casNumber || "Available in your portal")}</p><p>Next step: proceed with your visa application with guidance from ${escapeHtml(counsellor)}.</p>`;
  }

  if (status === "VISA_APPLIED") {
    if (opts.visaSubStatus === "VISA_APPROVED") {
      return `<p>Congratulations ${escapeHtml(opts.studentName)}!</p><p>Your visa has been approved for <strong>${escapeHtml(opts.universityName)}</strong>.</p><p>Next step: prepare for travel and enrolment.</p>`;
    }
    if (opts.visaSubStatus === "VISA_REJECTED") {
      return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Important update: your visa application outcome requires attention.</p><p>Next step: please contact ${escapeHtml(counsellor)} immediately to review options.</p>`;
    }
    return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Your visa application has been submitted.</p><p>Next step: we are waiting for a decision.</p>`;
  }

  if (status === "ENROLLED") {
    return `<p>Congratulations ${escapeHtml(opts.studentName)}!</p><p>Your enrolment is confirmed at <strong>${escapeHtml(opts.universityName)}</strong> for <strong>${escapeHtml(opts.courseName)}</strong>.</p><p>Welcome to your EduQuantica journey.</p>`;
  }

  return `<p>Hello ${escapeHtml(opts.studentName)},</p><p>Your application has been withdrawn.</p><p><strong>Reason:</strong> ${escapeHtml(opts.withdrawalReason || "Not specified")}</p>`;
}

export function applicationStatusEmail(
  status: ApplicationStatus,
  studentName: string,
  courseName: string,
  universityName: string,
  options?: {
    counsellorName?: string;
    visaSubStatus?: VisaSubStatus;
    offerConditions?: string;
    casNumber?: string;
    withdrawalReason?: string;
  },
) {
  const statusHeading = statusTitle(status, options?.visaSubStatus);
  const subject = `EduQuantica Update: ${statusHeading}`;
  const body = statusBody(status, {
    studentName,
    courseName,
    universityName,
    counsellorName: options?.counsellorName,
    visaSubStatus: options?.visaSubStatus,
    offerConditions: options?.offerConditions,
    casNumber: options?.casNumber,
    withdrawalReason: options?.withdrawalReason,
  });
  return { subject, html: layout(body) };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

export function applicationReceived(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Your application has been submitted to EduQuantica';
  const body = `
    <h2>Hello ${escapeHtml(studentName)},</h2>
    <p>We have successfully received your application for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong>.</p>
    <p>What happens next:</p>
    <ul>
      <li>Our team will review your documents and contact you if anything is missing.</li>
      <li>Your assigned counsellor is ${escapeHtml(_counsellorName || 'TBA')} and will guide you through the process.</li>
    </ul>
    <p>If you have any questions, reply to this email or contact your counsellor.</p>
  `;
  return { subject, html: layout(body) };
}

export function conditionalOffer(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Congratulations - Conditional Offer Received';
  const body = `
    <h2>Congratulations ${escapeHtml(studentName)}!</h2>
    <p>You have received a <strong>conditional offer</strong> for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong>.</p>
    <p>This offer is conditional upon meeting the following:</p>
    <ul>
      <li>Submission of outstanding documents</li>
      <li>Meeting academic/English requirements</li>
    </ul>
    <p>Your counsellor ${escapeHtml(_counsellorName || 'will contact you')} with next steps.</p>
  `;
  return { subject, html: layout(body) };
}

export function unconditionalOffer(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Congratulations - Unconditional Offer Received';
  const body = `
    <h2>Fantastic news ${escapeHtml(studentName)}!</h2>
    <p>You have received an <strong>unconditional offer</strong> for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong>.</p>
    <p>The document checklist is now available in your student portal. Please complete the checklist so we can progress to the next stage.</p>
    <p>Your counsellor ${escapeHtml(_counsellorName || '')} is available to help.</p>
  `;
  return { subject, html: layout(body) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function documentsPending(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Action Required - Documents Needed';
  const body = `
    <h2>Hello ${escapeHtml(studentName)},</h2>
    <p>We are missing some documents required to progress your application for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong>.</p>
    <p>Please upload the requested documents via your student portal as soon as possible.</p>
    <p>If you need assistance, contact your counsellor ${escapeHtml(_counsellorName || '')}.</p>
  `;
  return { subject, html: layout(body) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function casIssued(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Your CAS has been issued';
  const body = `
    <h2>Hello ${escapeHtml(studentName)},</h2>
    <p>Your CAS (Confirmation of Acceptance for Studies) for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong> has been issued.</p>
    <p>Next steps: use your CAS to apply for your student visa. Your counsellor will support you through the visa application process.</p>
  `;
  return { subject, html: layout(body) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function visaApproved(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Congratulations - Your Visa is Approved';
  const body = `
    <h2>Congratulations ${escapeHtml(studentName)}!</h2>
    <p>Your visa for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong> has been approved.</p>
    <p>Please review the pre-departure checklist and contact us if you need any assistance.</p>
  `;
  return { subject, html: layout(body) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function enrolled(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Welcome - You are now enrolled';
  const body = `
    <h2>Welcome ${escapeHtml(studentName)}!</h2>
    <p>You are now enrolled at <strong>${escapeHtml(universityName)}</strong> for <strong>${escapeHtml(courseName)}</strong>. We're excited for you.</p>
    <p>Contact your counsellor for post-enrolment support.</p>
  `;
  return { subject, html: layout(body) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function rejected(studentName: string, courseName: string, universityName: string, _counsellorName?: string) {
  const subject = 'Application Update from EduQuantica';
  const body = `
    <h2>Dear ${escapeHtml(studentName)},</h2>
    <p>We regret to inform you that your application for <strong>${escapeHtml(courseName)}</strong> at <strong>${escapeHtml(universityName)}</strong> was not successful.</p>
    <p>Our team is here to help you explore alternative options. Please contact your counsellor for guidance.</p>
  `;
  return { subject, html: layout(body) };
}

const templates = {
  applicationReceived,
  applicationStatusEmail,
  conditionalOffer,
  unconditionalOffer,
  documentsPending,
  casIssued,
  visaApproved,
  enrolled,
  rejected,
};

export default templates;
