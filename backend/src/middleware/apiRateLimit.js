import rateLimit from 'express-rate-limit';

export function createApiRateLimiter({ windowMs = 15 * 60 * 1000, limit = 300 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => req.originalUrl.split('?')[0] === '/api/health'
  });
}
