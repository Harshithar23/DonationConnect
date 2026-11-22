import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function welcomeEmail({ name }) {
  const safeName = escapeHtml(name);
  return {
    subject: 'Welcome to DonationConnect',
    text: `Hello ${name},\n\nWelcome to DonationConnect. Discover admin-approved NGO profiles, support community needs, and follow donation updates in one place.\n\nThank you for joining us.`,
    html: emailLayout({
      heading: `Welcome, ${safeName}!`,
      content: '<p style="line-height:1.7">Discover admin-approved NGO profiles, support community needs, and follow donation updates in one place. We are glad you are here.</p>',
      actionLabel: 'Explore DonationConnect',
      actionUrl: appUrl('/requests')
    })
  };
}
