# Hintro Meeting Intelligence Service

A backend service built with Node.js, Express, TypeScript, and Prisma (SQLite) that handles meeting management, extracts transcript-based insights (summaries, decisions, action items, and follow-ups) using Groq API, validates citations in a two-layer grounding system, and dispatches email notifications for overdue action items via Resend.

---

## Technical Stack
* **Runtime**: Node.js (v22.14.0+)
* **Framework**: Express.js with TypeScript
* **ORM & Database**: Prisma ORM with SQLite
* **LLM Orchestrator**: Groq SDK (`llama-3.3-70b-versatile` or similar)
* **Email Service**: Resend API
* **Scheduler**: node-cron
* **Validation**: Zod schema middleware
* **Logging**: Winston JSON logger with trace-propagating AsyncLocalStorage
* **Test Suite**: Jest & Supertest

---

## Environment Variables

Create a `.env` file in the root folder. You can use the values below:

```ini
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="development-jwt-signing-secret"

# Groq API Configuration
GROQ_API_KEY="gsk_your_real_groq_api_key"
GROQ_MODEL="llama-3.3-70b-versatile"

# Resend API Configuration
RESEND_API_KEY="re_your_real_resend_api_key"
SENDER_EMAIL="onboarding@resend.dev"

# Evaluation metadata
CANDIDATE_NAME="John Doe"
CANDIDATE_EMAIL="john@example.com"
REPOSITORY_URL="https://github.com/galaxy-grid/hintro-assignment"
DEPLOYED_URL="https://hintro-meeting-intelligence.up.railway.app"
```

---

## Local Execution Steps

Follow these instructions to start the service locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migrations
This will create the SQLite local database file `dev.db` and generate the Prisma Client:
```bash
npx prisma migrate dev --name init
```

### 3. Run in Development Mode
Starts the server with nodemon tracking live typescript modifications:
```bash
npm run dev
```
The server will boot on `http://localhost:3000`.

### 4. API Documentation
Navigate to [http://localhost:3000/api-docs](http://localhost:3000/api-docs) to interact with endpoints via Swagger UI.

### 5. Running Tests
Runs 17+ integration and unit tests covering JWT auth, pagination filters, schema parsers, citation validators, and idempotency scheduler states:
```bash
npm run test
```

---

## API Usage Examples

For full details, please refer to the Swagger documentation at `/api-docs`.

### Authentication
* **Register**: `POST /api/auth/register`
* **Login**: `POST /api/auth/login`
  * Returns a JWT token used to access all other endpoints.
  * *Header Format*: `Authorization: Bearer <JWT_TOKEN>`

### Meeting Management
* **Create Meeting**: `POST /api/meetings`
  * Body: Title, participants, meetingDate, transcript segments with timestamps.
* **Get Meeting**: `GET /api/meetings/:id`
* **List Meetings**: `GET /api/meetings`
  * Supports pagination (`page`, `limit`) and filtering by `participantEmail` or date ranges (`startDate`/`endDate`).

### AI meeting Analysis
* **Trigger Analysis**: `POST /api/meetings/:id/analyze`
  * Interacts with Groq API, validates structure with Zod, checks citation timestamps against actual transcript segments in the database, saves findings, and automatically populates the `ActionItem` table.

### Action Item Management
* **Get Overdue Action Items**: `GET /api/action-items/overdue`
  * Fetches items with `dueDate` in the past and status != `COMPLETED`.
* **Update status**: `PATCH /api/action-items/:id/status`
  * Enforces linear status transitions: `PENDING` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`.

---

## Deployment Instructions

The project can be deployed easily on **Railway**, **Render**, or **Fly.io**:
1. Connect your Github repository.
2. Configure the production Environment Variables in the platform dash.
3. Configure start scripts:
   - Build command: `npm run build && npx prisma generate`
   - Start command: `npx prisma migrate deploy && npm start`
4. For SQLite deployment, map a persistent storage volume to save the SQLite file, or swap the datasource provider in `prisma/schema.prisma` to PostgreSQL for database durability.
