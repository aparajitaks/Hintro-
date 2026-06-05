# Technical Decisions & Architecture Rationale

This document logs the core architectural decisions made during the implementation of the Meeting Intelligence Service, detailing the alternatives considered and associated trade-offs.

---

## 1. Database Choice: PostgreSQL with Prisma ORM
* **Choice**: PostgreSQL
* **Why**:
  PostgreSQL is a production-ready, highly reliable relational database. It natively supports concurrent writes (crucial for executing scheduled background cron tasks and serving concurrent API queries simultaneously without database lock issues). It also natively supports rich JSON data types (`jsonb`), which allows storing structured summaries, decisions, follow-ups, and citation arrays directly inside database fields. Using **Prisma ORM** decoupled our application logic from the database, meaning migrating from SQLite to PostgreSQL only required changing the schema provider and datasource URL—with zero changes required in controllers or business logic flow.
* **Alternatives Considered**:
  * *SQLite*: Great for zero-setup local reviews but poorly suited for concurrent scheduling tasks or persistent cloud deployments on Render/Railway.
  * *MongoDB*: Flexible for transcripts, but lacks relational integrity between Users, Meetings, and Action Items.
* **Trade-offs**:
  Requires a PostgreSQL database host running locally for execution, which increases local developer configuration requirements slightly.

---

## 2. Authentication Strategy: JWT (JSON Web Tokens)
* **Choice**: JWT Authentication
* **Why**:
  JWT is a stateless authentication mechanism perfect for stateless REST APIs. It avoids session storage on the server, making the backend horizontally scalable. It allows the client to securely store and attach credentials via the `Authorization: Bearer <token>` header, matching API standards.
* **Alternatives Considered**:
  * *Session-based Authentication*: Requires server-side session stores (like Redis) to verify login states, adding backend complexity and resource consumption.
  * *Mock Token Auth*: A static dummy header (e.g. `user_id = 1`). While simpler, real JWT auth with password hashing (`bcryptjs`) represents production-ready standards.
* **Trade-offs**:
  JWT tokens cannot be easily invalidated before expiration without implementing a token blacklist. Given the assignment scope, a standard 24-hour expiration window represents a balanced trade-off.

---

## 3. External Integration: Resend (Email Provider)
* **Choice**: Resend API
* **Why**:
  Resend was selected because it is a developer-centric email delivery service with clean documentation, official SDK support, and a free tier that makes it easy to send transactional notifications without SMTP hassles.
* **Alternatives Considered**:
  * *Discord/Slack Webhooks*: Easier to test via POST calls, but webhooks represent channel-bound chat streams rather than direct transactional, user-targeted notifications. Email is the standard communication channel for action items.
  * *SMTP (Nodemailer)*: Requires configuring mail servers, ports, and credentials, which is prone to security blocks (like SPF/DKIM flags).
* **Trade-offs**:
  To prevent testing failures if the evaluator lacks a Resend API Key, we added a mock fallback logger that outputs email dispatch logs to the console when mock/missing keys are detected.

---

## 4. Idempotency & Scheduler Lifecycle
* **Choice**: Date-bucketed `idempotencyKey` with a `PENDING -> IN_PROGRESS -> SENT/FAILED` state machine.
* **Why**:
  Background cron schedulers are prone to overlapping runs or process crashes.
  - To prevent duplicate reminders, we use a key composed of `"${actionItemId}:${YYYY-MM-DD}"`. The DB enforces a unique constraint on this key.
  - Just before executing the Resend API call, we transition the reminder history record to `IN_PROGRESS`. If the process crashes mid-send, the job won't retry infinitely because the scheduler blocks on both `SENT` and `IN_PROGRESS` states.
  - If a job gets stuck in `IN_PROGRESS` for over 5 minutes, the scheduler treats it as crashed, recovers it, and retries.
* **Alternatives Considered**:
  * *Simple Timestamp comparison*: E.g. "was sent in the last 24h". This is prone to time drift and timezone calculation discrepancies. Date-bucketing is precise and deterministic.
* **Trade-offs**:
  If a user updates an action item's due date twice in a single day, they will only receive one notification due to the 24h bucket boundary. This is acceptable to prevent mailbox spam.
