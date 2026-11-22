# Data Model and Abstraction

## Project overview

DonationConnect is an intermediary application for human-reviewed NGO profiles, moderated donation requests, money pledge records and goods pledge coordination. The platform does not process or verify money payments. Human review and advisory NGO screening do not establish legal authenticity.

## Logical ER model

```mermaid
erDiagram
  USER ||--o| NGO : owns
  NGO ||--o{ DONATION_REQUEST : publishes
  USER ||--o{ DONATION : creates
  NGO ||--o{ DONATION : receives
  DONATION_REQUEST o|--o{ DONATION : supports
  USER o|--o{ DONATION_REQUEST : reviews
  USER o|--o{ NGO : reviews

  USER {
    ObjectId _id PK
    string name
    string email UK
    string passwordHash
    string role
    string status
    number tokenVersion
    object profile
    string resetTokenHash
    datetime resetTokenExpiresAt
    number resetOtpAttempts
    datetime resetOtpSentAt
  }
  NGO {
    ObjectId _id PK
    ObjectId user FK_UK
    string legalName
    string registrationType
    string registrationNumber
    string registeredAddress
    array documents
    string verificationStatus
    ObjectId reviewedBy FK
    number riskScore
    array riskFlags
  }
  DONATION_REQUEST {
    ObjectId _id PK
    ObjectId ngo FK
    string title
    string description
    string donationType
    number targetAmount
    array goodsNeeded
    datetime deadline
    string status
    ObjectId reviewedBy FK
  }
  DONATION {
    ObjectId _id PK
    ObjectId donor FK
    ObjectId ngo FK
    ObjectId request FK_NULL
    string type
    number amount
    array items
    object pickup
    string status
    array tracking
    string receiptUrl
  }
```

## Data abstraction levels

### External / view level

- **Individual donor:** browse approved needs, make money pledge records and view own history.
- **Company / organization:** create itemized goods pledges and provide pickup details.
- **NGO:** complete profile, submit requests after approval, view incoming pledges and update goods milestones.
- **Administrator:** review NGO evidence and requests, manage account access and inspect platform statistics.

### Conceptual level

`User` stores account identity and role. An NGO user owns one `NGO` profile. An approved NGO publishes `DonationRequest` records. A donor creates `Donation` records associated with an NGO and optionally a request. Items, pickup fields, document references and tracking entries are embedded data.

### Logical / physical level

MongoDB stores four primary Mongoose collections: `users`, `ngos`, `donationrequests` and `donations`. ObjectIds model references; API routes enforce ownership because MongoDB does not enforce foreign keys. Mongoose adds unique user email and NGO owner indexes plus indexes for frequently queried donor, NGO and status fields.

## Business rules

1. New accounts are active unless an administrator suspends them. Suspended users cannot authenticate to protected routes.
2. NGO applications begin pending and need an administrator's approval before creating requests.
3. Newly created requests begin pending and are public only after admin approval while their NGO remains approved.
4. Individual accounts can record money pledges. Company/organization accounts can record goods pledges.
5. Money entries are records only. The API does not process payments, mark them received or report payment totals.
6. Only the owning, approved NGO can update goods tracking. The API accepts only valid forward milestones and records actor/time.
7. NGO screening flags are advisory; an administrator must review evidence against authoritative records.
8. Document and receipt URL fields are references, not secure document-upload/storage functionality.
9. A request is reserved by one pledge at a time; it cannot receive duplicate concurrent pledges.

## Important implementation boundary

Some persisted donation documents may contain payment metadata from an earlier application version. No current route creates or verifies payment transactions, and current screens identify money records as pledges. The database is not automatically migrated or rewritten. Payment gateways, secure private document storage, durable notification outbox/retries and a full audit log are future work.
