export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function appUrl(path) {
  const baseUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')[0]
    .replace(/\/$/, '');
  return `${baseUrl}${path}`;
}

export function emailLayout({ heading, content, actionLabel, actionUrl }) {
  const action = actionLabel && actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="background:#145c48;border-radius:6px;color:#fff;display:inline-block;font-weight:700;padding:13px 20px;text-decoration:none">${escapeHtml(actionLabel)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f6f7f1;color:#20372f;font-family:Arial,sans-serif"><div style="margin:0 auto;max-width:600px;padding:24px 12px"><div style="background:#145c48;border-radius:10px 10px 0 0;color:#fff;padding:22px 28px"><strong style="font-size:20px">DonationConnect</strong></div><main style="background:#fff;border:1px solid #e3e8df;border-top:0;border-radius:0 0 10px 10px;padding:28px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 18px">${escapeHtml(heading)}</h1>${content}${action}<hr style="border:0;border-top:1px solid #e3e8df;margin:28px 0 18px"><p style="color:#68776f;font-size:12px;line-height:1.6;margin:0">DonationConnect connects donors with admin-reviewed NGO profiles and helps track pledge progress. If you did not expect this email, you can ignore it.</p></main><p style="color:#68776f;font-size:11px;text-align:center">DonationConnect · Giving, with more meaning</p></div></body></html>`;
}
