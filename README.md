# DonationConnect

DonationConnect is a MERN donation-coordination application for individual donors, companies, organizations, NGOs and administrators. It supports human-reviewed NGO profiles, admin-reviewed donation requests, money pledge records, goods pledges, goods tracking and Gmail SMTP email notifications.

**Money pledges are records only. DonationConnect does not process, verify or report online payments as received. Payment gateway integration is a future enhancement.**

## Features

- Role-aware registration, login, profile editing, logout and password reset
- Bcrypt password hashing, expiring single-use password-reset OTPs, JWT authentication and backend role checks
- NGO profile submission, advisory completeness/duplicate screening and administrator decisions
- Admin-reviewed donation requests; only requests from approved NGOs are published
- Money pledge records for individuals and itemized goods pledges for company/organization accounts
- Goods donation tracking through pickup scheduled, collected, received and completed milestones
- Admin metrics, NGO/request review queues and user suspension/reactivation
- Gmail SMTP emails for registration, login, password reset, NGO review and donation lifecycle notifications

NGO screening is an administrative aid, not proof of legal authenticity. Document fields accept HTTPS references; the application does not currently upload or securely host documents.

## Requirements

- Node.js 20 or newer and npm
- MongoDB local instance or Atlas database
- Gmail account with a Google App Password for live email delivery

## Run locally

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI` and a unique `JWT_SECRET` (at least 32 characters). Set `CLIENT_ORIGIN=http://localhost:5173` and `FRONTEND_URL=http://localhost:5173` for local use.
3. Configure `EMAIL_USER`, `EMAIL_APP_PASSWORD`, and `EMAIL_FROM` in `backend/.env` for Gmail SMTP; set `ADMIN_EMAIL` for review notifications.
4. Install dependencies from the project root:

   ```sh
   npm run install:all
   ```

5. Create a local admin account after setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`:

   ```sh
   npm run seed:admin --prefix backend
   ```

6. Start the frontend and backend:

   ```sh
   npm run dev
   ```

Open the Vite URL at `http://localhost:5173`. The API is available at `http://localhost:5000/api`, and `GET /api/health` reports whether MongoDB is connected.

Password reset uses a six-digit email code that expires in 10 minutes, permits five incorrect attempts, and can be resent after a 60-second cooldown.

## Commands

Run these from the project root:

```sh
npm test
npm run build
npm run test:e2e
```

`npm test` uses Node's built-in test runner. The HTTP route tests mock persistence; the separate MongoDB integration workflow runs only when `MONGODB_TEST_URI` points to a dedicated database whose name contains `test`. It never falls back to `MONGODB_URI`.

The Playwright suite uses mocked API responses. It is browser-flow coverage, not a live backend or database integration test. See [Testing](./docs/TESTING.md) for the distinction and setup.

## Production and project limitations

- Configure production `NODE_ENV`, a unique JWT secret, remote MongoDB URI, exact HTTPS `CLIENT_ORIGIN`, HTTPS `FRONTEND_URL`, and Gmail SMTP credentials. Production startup validates these settings.
- Use private object storage with access controls for NGO documents and receipt references; current URL fields are not an upload service.
- Configure backups, monitoring, HTTPS, privacy/legal controls, and a shared rate-limit store before operating multiple API instances.
- Admin review and rule-based NGO screening do not establish legal authenticity.
- Money records are pledges, not transactions. There is no checkout, payment verification, payment webhook, UPI payment instruction or claim that funds were received. A payment gateway is future work only.
- An administrator can record NGO and request decisions; evidence review against authoritative records remains a manual responsibility.

## Documentation

- [API reference](./docs/API.md)
- [Architecture and data boundaries](./docs/ARCHITECTURE.md)
- [Testing guide](./docs/TESTING.md)
- [Project report](./docs/PROJECT_REPORT.md)
- [Data model and diagrams](./docs/ER_DIAGRAMS_AND_ABSTRACTION.md)
