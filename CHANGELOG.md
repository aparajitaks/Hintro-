# Changelog

All notable changes to this project will be documented in this file.

---

## [1.0.0] - 2026-06-05

### Added
- **Authentication**: JWT token login and registration features using password hashing (`bcryptjs`).
- **Meeting Management**: Paginated meetings retrieval and creation with participant email and date range search filters.
- **AI Meeting Analysis**: Integrated Groq API for transcript summaries, key decisions, follow-up suggestions, and action items.
- **Two-Layer Grounding System**:
  - Layer 1: Prompt-level indexed transcript constraints.
  - Layer 2: Zod response schema parsing combined with database citation timestamp verification and automatic feedback correction loops.
- **Action Item Status Manager**: Linear status progression validation (`PENDING` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`).
- **Background Cron Scheduler**: Overdue items reminder job using `node-cron` with date-bucketed idempotency locks (blocking on `SENT` and `IN_PROGRESS`) and crash state recovery (5-minute timeouts).
- **Email Notifications**: Integrated Resend email delivery service with log fallback for testing.
- **Request Traceability**: Trace ID propagation middleware using `AsyncLocalStorage` and structured JSON logs (Winston).
- **API Documentation**: Publicly accessible Swagger OpenAPI interactive interface served at `/api-docs`.
- **Health Checks**: Express health probes `/health` and candidate parameters metadata `/api/evaluation`.
- **Database System**: Configured PostgreSQL engine and migrations using Prisma ORM.
- **Testing**: Built 17 automated integration and unit test cases using Jest and Supertest.
