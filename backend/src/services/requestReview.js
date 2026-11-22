import { sendReviewEmail } from './emailService.js';

export async function requestEmailReview(kind, id, title, details, eventId = id) {
  const baseUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');
  const reviewUrl = `${baseUrl}/admin`;
  return sendReviewEmail(kind, title, details, reviewUrl, eventId);
}
