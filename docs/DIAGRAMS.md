# DonationConnect Diagrams

## System context

```mermaid
flowchart LR
  Donor[Individual / company / organization donor] -->|Account, pledge, pickup details| App((DonationConnect))
  NGO[NGO applicant / approved NGO] -->|Profile, documents, requests, goods updates| App
  Admin[Administrator] -->|Review decisions and account management| App
  App --> DB[(MongoDB)]
  App -->|Gmail SMTP notifications| Gmail[Gmail]
  App -->|Public approved requests and private tracking| Donor
  App -->|Review outcomes and incoming pledges| NGO
```

## Use cases

```mermaid
flowchart LR
  Individual([Individual donor]) --> Browse[Browse approved needs]
  Individual --> Money[Record money pledge]
  Company([Company / organization]) --> Browse
  Company --> Goods[Record itemized goods pledge]
  NGO([NGO / trust]) --> Profile[Submit profile for human review]
  NGO --> Need[Create request for admin review]
  NGO --> Track[Update goods donation milestones]
  Admin([Platform admin]) --> Verify[Review NGO registration]
  Admin --> Approve[Approve, reject or close requests]
  Admin --> Accounts[Manage user access and dashboard]
  Money --> Record[Save pledge record; no payment is processed]
  Goods --> Pickup[Pickup, collection, receipt and completion]
```

## NGO review and request publication

```mermaid
sequenceDiagram
  participant Applicant as NGO user
  participant UI as React frontend
  participant API as Express API
  participant DB as MongoDB
  participant Admin as Administrator
  participant Mail as Gmail SMTP
  Applicant->>UI: Submit registration profile and HTTPS references
  UI->>API: PATCH /api/ngos/me
  API->>API: Compute advisory completeness/duplicate flags
  API->>DB: Save NGO profile as pending
  API->>Mail: Send review notification when configured
  Admin->>API: Approve or reject profile
  API->>DB: Record decision and reviewer
  Applicant->>API: POST /api/requests after approval
  API->>DB: Save new request as pending
  Admin->>API: Approve request
  API->>DB: Publish only if NGO remains approved
```

## Donation states

```mermaid
stateDiagram-v2
  state "Money pledge record" as MoneyPledge
  state "Goods pledge" as GoodsPledge
  [*] --> MoneyPledge: Individual records amount
  [*] --> GoodsPledge: Company/organization records items
  GoodsPledge --> PickupScheduled: Owning approved NGO
  PickupScheduled --> Collected: Owning approved NGO
  Collected --> Received: Owning approved NGO
  Received --> Completed: Receipt reference required
  GoodsPledge --> Cancelled: Before collection
  PickupScheduled --> Cancelled: Before collection
  GoodsPledge --> Disputed
  PickupScheduled --> Disputed
  Collected --> Disputed
  Received --> Disputed
```

Money pledges remain records only; there are no payment or receipt transitions for money.

## Data model

```mermaid
erDiagram
  USER ||--o| NGO : owns
  NGO ||--o{ DONATION_REQUEST : publishes
  USER ||--o{ DONATION : pledges
  NGO ||--o{ DONATION : receives
  DONATION_REQUEST o|--o{ DONATION : supports
  USER ||--o{ DONATION_TRACKING_EVENT : records
  USER { ObjectId id string email string role string status }
  NGO { ObjectId id string legalName string registrationNumber string verificationStatus }
  DONATION_REQUEST { ObjectId id string title string donationType number targetAmount string status }
  DONATION { ObjectId id string type number amount string status array items object pickup }
  DONATION_TRACKING_EVENT { ObjectId id string status datetime timestamp }
```

Tracking events, donation goods and pickup information are embedded subdocuments in the current Mongoose models.
