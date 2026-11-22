import { appUrl, emailLayout, escapeHtml } from './layout.js';

export function donationConfirmation({ name, donation }) {
  const amount = donation.type === 'money'
    ? `INR ${Number(donation.amount).toLocaleString('en-IN')}`
    : donation.items.map(item => `${item.quantity} ${item.unit || 'items'} of ${item.name}`).join(', ');
  const requestTitle = donation.request?.title;
  const request = requestTitle ? ` for ${requestTitle}` : '';
  return {
    subject: 'Your DonationConnect donation pledge',
    text: `Hello ${name},\n\nYour ${donation.type} donation pledge${request} has been recorded.\nReference: ${donation._id}\nDetails: ${amount}${donation.type === 'money' ? '\nThis is a pledge record only; no payment has been processed or confirmed.' : ''}\n\nYou can follow its progress from your donation tracking page.`,
    html: emailLayout({
      heading: 'Thank you for your donation pledge',
      content: `<p style="line-height:1.7">Hello ${escapeHtml(name)}, your ${escapeHtml(donation.type)} donation pledge${requestTitle ? ` for <strong>${escapeHtml(requestTitle)}</strong>` : ''} has been recorded.</p><p><strong>Reference:</strong> ${escapeHtml(donation._id)}<br><strong>Details:</strong> ${escapeHtml(amount)}</p>${donation.type === 'money' ? '<p style="line-height:1.7">This is a pledge record only. DonationConnect has not processed or confirmed a payment, and this record does not mean funds have been received.</p>' : ''}<p style="line-height:1.7">You can follow its progress from your donation tracking page.</p>`,
      actionLabel: 'View donation tracking',
      actionUrl: appUrl(`/tracking/${encodeURIComponent(donation._id)}`)
    })
  };
}
