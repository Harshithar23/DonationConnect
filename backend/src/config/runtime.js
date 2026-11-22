import { isIP } from 'node:net';

export function validateRuntimeConfig(env) {
  if (env.NODE_ENV !== 'production') return;
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /replace|change.?this|example/i.test(env.JWT_SECRET)) {
    throw new Error('Production requires a unique JWT_SECRET containing at least 32 characters.');
  }
  if (!env.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//i.test(env.MONGODB_URI) || /127\.0\.0\.1|localhost/i.test(env.MONGODB_URI)) {
    throw new Error('Production requires a remote MongoDB connection string in MONGODB_URI.');
  }
  const dnsServers = (env.DNS_SERVERS || '').split(',').map(server => server.trim()).filter(Boolean);
  if (dnsServers.some(server => !isIP(server))) {
    throw new Error('DNS_SERVERS must contain comma-separated IPv4 or IPv6 addresses.');
  }
  for (const [name, value] of [['CLIENT_ORIGIN', env.CLIENT_ORIGIN], ['FRONTEND_URL', env.FRONTEND_URL]]) {
    if (!value) throw new Error(`${name} is required in production.`);
    for (const entry of value.split(',')) {
      let parsed;
      try { parsed = new URL(entry.trim()); } catch { throw new Error(`${name} must contain valid absolute URLs.`); }
      if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
        throw new Error(`${name} must use a public HTTPS URL in production.`);
      }
      if (name === 'CLIENT_ORIGIN' && parsed.origin !== entry.trim()) {
        throw new Error('Each CLIENT_ORIGIN entry must be an origin without a path.');
      }
    }
  }
  if (!env.EMAIL_USER || !env.EMAIL_APP_PASSWORD || !env.EMAIL_FROM) {
    throw new Error('Production requires EMAIL_USER, EMAIL_APP_PASSWORD, and EMAIL_FROM for Gmail email delivery.');
  }
  const senderAddress = env.EMAIL_FROM.match(/<([^<>]+)>/)?.[1]?.trim() || env.EMAIL_FROM.trim();
  const senderDomain = senderAddress.match(/^[^@\s]+@([^@\s]+)$/)?.[1]?.toLowerCase();
  if (!senderDomain || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(senderAddress)) {
    throw new Error('Production EMAIL_FROM must be a valid email address.');
  }
}
