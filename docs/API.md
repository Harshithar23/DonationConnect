# API Reference

Base URL: `http://localhost:5000/api`. Protected routes require `Authorization: Bearer <JWT>`. JSON validation errors return `400`; missing/expired authentication returns `401`; role/ownership failures return `403`; conflicting lifecycle changes return `409`.

## Health and authentication

- `GET /health` — API and MongoDB health.
- `POST /auth/register` — `{name,email,password,role,phone?,legalName?,registrationType?,registrationNumber?,registeredAddress?}`. Roles: `individual`, `company`, `organization`, `ngo`.
- `POST /auth/login` — `{email,password}`. Suspended accounts cannot sign in.
- `GET /auth/me` — current user and (for NGO accounts) profile metadata.
- `PATCH /auth/profile` — validated name, phone and profile fields.
- `POST /auth/forgot-password` — `{email}`. Sends a six-digit OTP to an active account if available and returns the same generic response for unknown accounts. OTPs expire in 10 minutes; resend requests are accepted after a 60-second cooldown.
- `POST /auth/reset-password` — `{email,otp,password}`. Accepts a six-digit OTP and a 10–128 character password. Five incorrect OTP attempts are allowed; successful verification atomically updates the bcrypt password hash, consumes the OTP, and invalidates existing JWTs.

Both password-reset endpoints have additional IP-based rate limits. Registration and successful login send Gmail SMTP notifications when configured. API responses never contain password hashes or OTP hashes.

## NGOs

- `GET /ngos/public` — admin-approved NGO profiles with public fields only.
- `GET /ngos/me` — NGO account's own profile.
- `PATCH /ngos/me` — update registration details, cause areas and HTTPS document references. Updates return the profile to `pending` for another administrator review.
- `GET /ngos/admin/review` — admin review queue.
- `PATCH /ngos/admin/:id/decision` — admin body `{decision:'approved'|'rejected'|'under_review'|'suspended',notes?}`.

Completeness and duplicate checks provide advisory risk flags only. Administrator review against authoritative records is still required. Documents are references; private file storage is not implemented.

## Donation requests

- `GET /requests` — approved/reserved, non-expired requests whose NGO is approved. Optional filters: `?category=education&type=money|goods`.
- `GET /requests/:id` — public details for an eligible request.
- `POST /requests` — approved NGO submits a request; it begins `pending`. Money or mixed requests need a positive target; goods or mixed requests need item quantities. Optional deadlines must be future dates.
- `GET /requests/mine` — current NGO's requests.
- `GET /requests/admin/review` — admin pending-request queue.
- `PATCH /requests/admin/:id/decision` — admin body `{decision:'approved'|'rejected'|'closed',notes?}`. Only pending requests may be approved/rejected/closed; an approved request may be closed. An NGO must still be approved when its request is published.

Public responses omit internal review notes and exact addresses. A request can be reserved by one pledge at a time; it remains visible as in progress and cannot accept a duplicate pledge.

## Donations and tracking

- `POST /donations` — create a pledge for an approved NGO. Body: `{ngoId,requestId?,type:'money'|'goods',amount?,items?,pickup?}`.
  - Individual accounts may create money pledge records in the existing fixed INR choices of ₹1,000–₹10,000.
  - Company and organization accounts may create goods pledges with itemized quantities and pickup details.
  - Money records start as `pledged` with `payment.method: 'pledge_only'` and `verificationStatus: 'not_required'`. The endpoint returns no checkout or payment instructions.
- `GET /donations/mine` — current user's records; NGOs see records for their NGO; admins see all.
- `GET /donations/:id` — donation details for the donor, owning NGO or admin.
- `PATCH /donations/:id/tracking` — owning, approved NGO updates a goods donation. Notes must contain at least three characters. HTTPS receipt references are accepted; a receipt reference is required to mark a goods pledge completed.

Goods lifecycle: `pledged → pickup_scheduled → collected → received → completed`. Cancellation is available before collection; disputes can be recorded from eligible milestones. Completed, cancelled and disputed records cannot be reopened through ordinary tracking updates. Money pledges cannot be marked paid, received or completed through tracking.

Money records do not represent successful payments, payment receipt or settlement. Payment processing and verification are future enhancements.

## Administration

All `/admin` routes require an active admin JWT.

- `GET /admin/overview` — total users, user counts by role, NGO/request review counts, donation record count, and pledge-only money/goods statistics.
- `GET /admin/users` — bounded user list with safe account fields.
- `PATCH /admin/users/:id/status` — `{status:'active'|'suspended'}`. Cannot change the current admin's status. Status changes invalidate existing tokens.

## Email notifications

The backend sends email through Nodemailer using Gmail SMTP. Configure `EMAIL_USER`, `EMAIL_APP_PASSWORD` (a Google App Password), and `EMAIL_FROM`; `ADMIN_EMAIL` is optional and used for review notifications. Keep these values server-side. Email delivery is tracked in MongoDB with duplicate prevention; ordinary notification failures do not roll back application workflows. Password-reset delivery failures invalidate the new OTP and return an error.

## Data migration note

Historical donation records may contain payment metadata from an earlier version. Current routes do not create or verify payment transactions, and the current UI does not present those records as newly verified payments. Existing database records are not automatically rewritten.
