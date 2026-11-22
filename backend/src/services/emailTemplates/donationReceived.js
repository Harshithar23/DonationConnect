import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function donationReceived({ name, donation }) {
  return {
    subject: 'Thank you — your donation has been received',
    text: `Hello ${name},\n\nThe NGO has marked your donation ${donation._id} as received. Thank you for supporting their work.`,
    html: emailLayout({
      heading: 'Your donation has been received',
      content: `<p style="line-height:1.7">Hello ${escapeHtml(name)}, the organization has confirmed receipt of your donation <strong>${escapeHtml(donation._id)}</strong>.</p><p style="line-height:1.7">Thank you for supporting their work and making a difference in the community.</p>`,
      actionLabel: 'View donation tracking',
      actionUrl: appUrl(`/tracking/${encodeURIComponent(donation._id)}`)
    })
  };
}
