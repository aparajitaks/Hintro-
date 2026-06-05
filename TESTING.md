# Testing Strategy & Coverage

This document outlines the testing strategy, scenarios executed, edge cases handled, and discoverable limitations of the Meeting Intelligence Service test suite.

---

## 1. Test Scenarios Executed

We implemented 17 integration and unit tests using **Jest** and **Supertest**. Tests run against an isolated SQLite database file `test.db`.

### 1. Authentication (`tests/auth.test.ts`)
- **User Registration**: Verifies that a user can register successfully, passwords are encrypted, and database records are created.
- **Duplicate Registration**: Verifies that registering with an existing email returns a `409 CONFLICT` error.
- **Payload Validation**: Verifies that Zod schemas reject invalid emails or short passwords with a `400 VALIDATION_ERROR`.
- **User Login**: Verifies that users can sign in with valid credentials, returning a signed JWT token.
- **Unauthorized Login**: Verifies that invalid credentials return a `401 UNAUTHORIZED` error.

### 2. Meeting Management (`tests/meeting.test.ts`)
- **Meeting Creation**: Verifies that authenticated users can create meetings with title, participants list, dates, and transcript lines.
- **Meeting Retrieval**: Verifies that a meeting can be fetched by ID and returns correct segments.
- **Participant Filter**: Verifies that `GET /api/meetings?participantEmail=...` returns only meetings including that participant.
- **Date Range Filter**: Verifies that `GET /api/meetings?startDate=...&endDate=...` restricts results to meetings within the target window.

### 3. Citation Validation (`tests/citation.test.ts`)
- **Schema Validation**: Tests that the Zod schema checks the structure of AI responses and catches malformed JSON.
- **Database Checking**: Confirms that valid citations are preserved, and hallucinated citations (timestamps not present in transcript segments) are detected and stripped/flagged.

### 4. Overdue Scheduler (`tests/scheduler.test.ts`)
- **Scan & Dispatch**: Verifies that overdue items are identified and Resend email alerts are dispatched.
- **State Progression**: Confirms that entries move through `PENDING` &rarr; `IN_PROGRESS` &rarr; `SENT` or `FAILED` states.
- **Idempotency checks**: Verifies that a notification is only sent once per action item per day (blocks on `SENT` and `IN_PROGRESS`).
- **Crash Recovery**: Verifies that stuck `IN_PROGRESS` reminders (older than 5 minutes) are treated as crashed, picked up, and retried.

---

## 2. Edge Cases Handled

1. **Stuck Reminder Recovery**: If the service crashes or terminates while sending an email, the database status remains `IN_PROGRESS`. The job checks the `updatedAt` timestamp: if it's older than 5 minutes, it resets it and retries, preventing infinite lockouts.
2. **Invalid Request Body Parser**: Malformed JSON sent in HTTP requests is caught by Express and formatted as a unified error response with a trace ID.
3. **Sequential Status Enforcement**: When patching action items, the controller checks that transitions progress linearly (`PENDING` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`). Direct jumps (`PENDING` &rarr; `COMPLETED`) or regression requests are blocked.
4. **Isolated Test Database**: We use a distinct SQLite database `test.db` which is initialized and wiped clean before each test block to ensure zero interference with development logs.

---

## 3. Discovered Limitations

1. **Async Cron Triggers**: The background reminder job runs in the process loop. In a production cluster, running node-cron directly on application instances can cause duplicate schedules unless locked with Redis or a dedicated worker queue (e.g. BullMQ).
2. **Mock Email Provider**: Since free Resend accounts can only send emails to the registered developer address, testing live delivery with custom participant addresses will require domain verification.
