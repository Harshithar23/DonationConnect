# DonationConnect — Final-Year Project Report

**Project type:** MERN donation-coordination application  
**Technologies:** React, Vite, Express, Node.js, MongoDB/Mongoose, Nodemailer, Gmail SMTP

## Abstract

DonationConnect is a web application for coordinating community needs between individual donors, company/organization donors, NGOs and administrators. It provides role-aware accounts, human review of NGO profiles and requests, pledge records, goods pickup tracking, administrative controls and Gmail SMTP notifications.

Money contributions are represented only as pledges or records. No online payment is processed, verified, received or settled by the application. Payment gateway integration is future work.

## Problem and objectives

Donors can have difficulty finding current community needs and following what happens after a contribution. NGOs need a way to publish requests and coordinate in-kind contributions. DonationConnect centralizes approved requests and records later goods milestones.

- Provide registration, login, profile and password reset for individual, company, organization and NGO roles.
- Require admin approval before NGO requests become public.
- Enforce money-vs-goods account roles on the backend.
- Track goods pledge pickup, collection, receipt, completion and exceptions.
- Provide admin dashboards, user management and Gmail SMTP notifications.

## Roles

| Role | Main capabilities |
|---|---|
| Individual | Browse requests, create money pledge records, view own donation history |
| Company / organization | Create itemized goods pledges and provide pickup details |
| NGO | Submit profile for review, create requests after approval, view incoming pledges, update goods tracking |
| Admin | Review NGO profiles and requests, manage account status, view platform statistics |

## Architecture

The React/Vite single-page application calls a JSON REST API implemented with Express. The API authenticates JWT bearer tokens, validates requests, enforces role and ownership checks, and persists data using Mongoose. Nodemailer sends Gmail SMTP emails directly from the backend.

Primary collections are `users`, `ngos`, `donationrequests` and `donations`. ObjectIds model references; items, pickup details, NGO document references and tracking entries are embedded data.

See [Architecture](./ARCHITECTURE.md), [Diagrams](./DIAGRAMS.md), and [Data Model](./ER_DIAGRAMS_AND_ABSTRACTION.md) for diagrams and details.

## Functional flow

1. A user registers with an individual, company, organization or NGO role.
2. NGO applications begin pending and receive advisory completeness/duplicate flags.
3. An admin reviews an NGO profile and records a decision. Screening does not prove legal authenticity.
4. An approved NGO creates a request; it begins pending until an administrator approves publication.
5. Individuals create money pledge records; company/organization accounts create itemized goods pledges.
6. Only the owning approved NGO can update goods tracking milestones. A request can be reserved by one pledge at a time.
7. Gmail SMTP sends account and lifecycle emails when configured, including six-digit OTP password resets.

## Security and integrity controls

- Passwords use bcrypt; six-digit reset OTPs are hashed, expire after 10 minutes, allow five incorrect attempts and are consumed atomically once.
- JWTs expire and include a token version; suspension and password reset invalidate existing sessions.
- Backend routes enforce active account, role and object-level ownership.
- Zod validation, Helmet, CORS allowlisting, JSON body-size limits and rate limits are enabled.
- Sensitive user fields are excluded from JSON responses; public NGO/request endpoints select limited fields.
- Money records do not represent successful or received payments.

NGO documents and receipt references are HTTPS URLs, not a private file-upload/storage system. Secure document storage, durable email retries, audit logs, production monitoring and tested deployment procedures remain future operational work.

## Testing interpretation

`npm test` uses Node's built-in test runner. Backend HTTP route tests mock persistence. The optional MongoDB integration workflow requires a dedicated `MONGODB_TEST_URI` whose database name contains `test`; it is skipped if absent. Playwright tests mock API responses and validate browser flows only. A mocked browser test is not a backend/database integration test.

## Limitations and future enhancements

- Human administrators must review NGO documents against authoritative records.
- Secure file uploads, private document storage, audit logs and durable notification retries are not implemented.
- Payment gateway integration and payment verification are future enhancements only.

## References

- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
- [Data Model and Abstraction](./ER_DIAGRAMS_AND_ABSTRACTION.md)
