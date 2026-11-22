import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function donorConfirmation({ name, role }) {
  return {
    subject: 'Your DonationConnect donor account is ready',
    text: `Hello ${name},\n\nYour ${role} account is ready. You can explore admin-approved NGO requests, make money or goods pledges where available, and follow donation updates from your dashboard.`,
    html: emailLayout({
      heading: 'Your donor account is ready',
      content: `<p style="line-height:1.7">Hello ${escapeHtml(name)}, your <strong>${escapeHtml(role)}</strong> account is ready. Explore admin-approved NGO requests, support eligible community needs, and follow donation updates from your dashboard.</p>`,
      actionLabel: 'View donation requests',
      actionUrl: appUrl('/requests')
    })
  };
}
