

import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function ngoApproval({ name, legalName, decision, notes = '' }) {

  // Validate decision inside the function
  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error(`Invalid NGO review decision: ${decision}`);
  }

  const approved = decision === 'approved';

  const nextSteps = approved
    ? 'You can now complete your organization profile, publish donation requests, and manage contributions through your dashboard.'
    : 'Review the administrator notes, update your organization profile or documents, and resubmit it for review if needed.';

  return {
    subject: `DonationConnect organization review: ${approved ? 'approved' : 'update required'}`,

    text: `Hello ${name},

The verification review for ${legalName} is ${decision}.
${notes ? `Administrator notes: ${notes}` : ''}

${nextSteps}

Team DonationConnect`,

    html: emailLayout({
      heading: approved
        ? 'Your organization is approved'
        : 'Your organization needs an update',

      content: `
        <p style="line-height:1.7">
          Hello ${escapeHtml(name)}, the verification review for
          <strong>${escapeHtml(legalName)}</strong> is
          ${approved ? 'approved' : 'not approved at this time'}.
        </p>

        ${notes
          ? `<p style="line-height:1.7"><strong>Administrator notes:</strong> ${escapeHtml(notes)}</p>`
          : ''}

        <p style="line-height:1.7">${escapeHtml(nextSteps)}</p>
      `,

      actionLabel: 'Open your dashboard',
      actionUrl: appUrl('/dashboard')
    })
  };
}
