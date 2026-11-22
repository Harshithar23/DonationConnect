# Testing

## Standard commands

From the project root:

```sh
npm test
npm run build
npm run test:e2e
```

`npm test` invokes Node's built-in `node --test` runner for backend unit tests and HTTP-route tests. The HTTP-route tests mock model persistence; they verify routing, authorization, payload validation and pledge/tracking behavior, but they are not MongoDB integration tests.

## Real MongoDB integration workflow

`backend/src/integration/workflows.integration.test.js` runs the full registration, NGO review, request moderation, money/goods pledge, goods tracking, admin metrics, and OTP password reset flow against real Mongoose collections when `MONGODB_TEST_URI` is set.

- Use a separate database whose name contains `test` (for example `DonationConnect_test`).
- Never point `MONGODB_TEST_URI` at production or at the normal development database.
- The test refuses a database name without `test`, never falls back to `MONGODB_URI`, and clears collections in the dedicated test database before and after the workflow.
- If `MONGODB_TEST_URI` is not set, this test is skipped. That skip is not a successful database integration run.
- Gmail transport is replaced by a test double; the test does not send real emails.

## Playwright browser tests

The Playwright tests run in Chromium and use `page.route()` to mock API responses. They validate browser navigation, forms and visible results only; they do not prove backend, MongoDB, or Gmail SMTP behavior.

Install the browser once if needed:

```sh
cd frontend
npx playwright install chromium
cd ..
npm run test:e2e
```

## Email tests

Backend email tests replace Nodemailer's `sendMail` and MongoDB notification methods with test doubles. They verify message content, duplicate prevention, notification tracking and SMTP failure handling without contacting Gmail.

## Manual setup checklist

- Start MongoDB and configure `backend/.env`; confirm `/api/health`.
- Seed an admin and register accounts for individual, company, organization and NGO roles.
- Complete an NGO profile, review it as an admin, then create and approve requests.
- Confirm each donor role can create only its allowed pledge type.
- Track a goods pledge through pickup, collection, receipt and completion; confirm invalid transitions and non-owner updates are rejected.
- Confirm a money pledge remains a pledge record; no payment is attempted or reported as received.
- Configure `EMAIL_USER`, `EMAIL_APP_PASSWORD` (a Google App Password), and `EMAIL_FROM` in `backend/.env`. Use an inbox you control to verify welcome, login, OTP reset, review and donation messages.
- Verify wrong and expired OTPs are rejected, the fifth incorrect attempt locks the code, resend is blocked for 60 seconds, and a successful reset cannot reuse the OTP.
- Suspend and reactivate a test account; confirm prior JWTs no longer work.
