import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function loginAlert({ name, time, userAgent }) {
  return {
    subject: 'New sign-in to your DonationConnect account',
    text: `Hello ${name},\n\nA new sign-in to your DonationConnect account was detected at ${time}.\nBrowser/device: ${userAgent || 'Not provided'}\n\nIf this was not you, reset your password and contact support.`,
    html: emailLayout({
      heading: 'New sign-in detected',
      content: `<p style="line-height:1.7">Hello ${escapeHtml(name)}, a new sign-in to your DonationConnect account was detected.</p><p><strong>Time:</strong> ${escapeHtml(time)}<br><strong>Browser/device:</strong> ${escapeHtml(userAgent || 'Not provided')}</p><p style="line-height:1.7">If this was not you, reset your password and contact support. This message does not include your password or authentication token.</p>`,
      actionLabel: 'Reset your password',
      actionUrl: appUrl('/forgot-password')
    })
  };
}
