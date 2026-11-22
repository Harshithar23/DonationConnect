# DonationConnect — Project Report

## Abstract

DonationConnect is a web-based coordination platform that connects donors with NGOs. It provides account roles, admin review of NGO profiles and donation requests, money pledge records, goods pledge coordination, tracking for goods milestones, an admin dashboard and Gmail SMTP email notifications.

Money contributions are represented only as pledges or records. The project does not process, verify or claim to receive payments. Payment gateway integration is a future enhancement.

## Problem statement

Donors need a clear way to discover community needs, while NGOs need to share current requests and coordinate in-kind contributions. DonationConnect centralizes requests and status updates and keeps human review in the NGO and request publication workflows.

## Objectives

1. Provide registration, login, profile and password recovery for individual, company, organization and NGO roles.
2. Require administrator review before NGO requests become public.
3. Enforce role-specific money and goods pledge creation on the server.
4. Track goods pickup, collection, receipt, completion, cancellation and disputes.
5. Provide admin review, account management and role-wise statistics.
6. Send event-specific emails through Gmail SMTP when configured, including OTP-based password reset.
7. Preserve security and privacy boundaries and document features accurately.

## Technology

- **Frontend:** React, React Router, Vite, Playwright
- **Backend:** Node.js, Express, Zod, JWT, bcryptjs, Helmet and express-rate-limit
- **Database:** MongoDB with Mongoose models
- **Email:** Nodemailer using Gmail SMTP
- **Testing:** Node built-in `node:test` and Playwright

## Main workflows

### Authentication

Registration creates the selected user role; passwords are bcrypt-hashed. Login issues an expiring JWT. Password resets store a six-digit OTP hash, expire after 10 minutes, allow five incorrect attempts, consume the OTP atomically once and invalidate previous tokens. Suspended users cannot access protected endpoints.

### NGO review and request publication

NGOs submit registration details and HTTPS document references. Basic completeness and duplicate checks produce advisory flags. An administrator reviews the profile and records a decision. Approved NGOs can submit requests, which remain private in `pending` until an administrator approves them.

### Donations and tracking

Individuals can record money pledge amounts. Company and organization accounts can record goods items and pickup details. A linked request is reserved to prevent duplicate pledges. Only the owning approved NGO can update goods milestones. Money pledge entries do not imply that a payment was made or received.

### Administration and email

Admin screens show role-wise account counts, NGO/request review queues and pledge-only statistics. Administrators can suspend or reactivate users; status changes invalidate existing sessions. Gmail SMTP sends welcome, login, password-reset OTP, NGO review and donation lifecycle notifications when configured. Email failure does not undo a saved application record.

## Security and integrity

- Password hashes and reset hashes are not included in API JSON.
- API routes enforce roles, account status and donation/request ownership.
- Zod validates request data; Helmet, CORS allowlisting, payload limits and rate limits protect the API boundary.
- Reset tokens are single-use and existing JWTs are invalidated after reset.
- Public NGO/request responses use limited fields; donation records are access-controlled.
- Screening is advisory and does not establish legal authenticity.
- Document URL fields are not a secure upload service.
- Money records are pledge-only; no active payment processing is available.

## Testing

Node tests include unit and model-mocked HTTP route checks. A separate real MongoDB workflow is opt-in via `MONGODB_TEST_URI` and refuses a database whose name does not contain `test`; it is skipped if no isolated URI is configured. Playwright browser tests mock API responses and are not backend/database tests. See [Testing](./TESTING.md).

## Limitations and future work

- Authoritative legal NGO verification remains a manual administrative responsibility.
- Secure private file uploads, access-controlled receipt storage and audit logs are not implemented.
- Gmail SMTP delivery is best-effort without a durable retry queue.
- Real database integration tests require a dedicated test MongoDB URI.
- Payment gateway integration, payment verification and settlement workflows are future enhancements.

## Conclusion

DonationConnect provides a demonstrable end-to-end NGO review, request moderation, pledge recording, goods tracking and admin workflow without claiming to process payments. Operational safety depends on configuring MongoDB and Gmail SMTP, reviewing NGO evidence appropriately, and using private storage for documents before any public deployment.
