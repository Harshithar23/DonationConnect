
import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function loginGreeting({ name }) {
  const safeName = escapeHtml(name || 'there');

  return {
    subject: 'Good to see you again at DonationConnect',

    text: `Hello ${name || 'there'},

You have successfully signed in to DonationConnect.

Discover admin-approved NGO profiles, support community needs, and follow donation updates in one place.

Thank you for being part of our community.

Team DonationConnect`,

    html: emailLayout({
      heading: `Good to see you again, ${safeName}!`,

      content: `
        <p style="line-height:1.7">
          You have successfully signed in to DonationConnect.
        </p>

        <p style="line-height:1.7">
          Discover admin-approved NGO profiles, support community needs,
          and follow donation updates in one place.
        </p>

        <p style="line-height:1.7">
          Thank you for being part of our community!
        </p>
      `,

      actionLabel: 'Explore DonationConnect',
      actionUrl: appUrl('/requests')
    })
  };
}
