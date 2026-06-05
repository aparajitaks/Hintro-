# Hintro Meeting Intelligence Service

A backend service built with Node.js, Express, TypeScript, and Prisma (PostgreSQL) that handles meeting management, extracts transcript-based insights (summaries, decisions, action items, and follow-ups) using Groq API, validates citations in a two-layer grounding system, and dispatches email notifications for overdue action items via Resend.

---

## Technical Stack
* **Runtime**: Node.js (v22.14.0+)
* **Framework**: Express.js with TypeScript
* **ORM & Database**: Prisma ORM with PostgreSQL
* **LLM Orchestrator**: Groq SDK (`llama-3.3-70b-versatile`)
* **Email Service**: Resend API
* **Scheduler**: node-cron
* **Validation**: Zod schema middleware
* **Logging**: Winston JSON logger with trace-propagating AsyncLocalStorage
* **Test Suite**: Jest & Supertest

---

## Environment Variables

Copy the `.env.example` file to `.env` in the root folder and fill in your actual credentials:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` is set in the following PostgreSQL format:
```ini
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME?schema=public"
```

---

## Local Execution Steps

Follow these instructions to start the service locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up PostgreSQL Database
Install PostgreSQL locally, create a database named `meeting_intelligence`, and set your `DATABASE_URL` in your `.env` file accordingly.

### 3. Run Database Migrations
Generate the Prisma Client and sync the database schema:
```bash
npm run db:generate
npm run db:migrate -- --name init
```

### 4. Run in Development Mode
Starts the server with nodemon tracking live TypeScript modifications:
```bash
npm run dev
```
The server will boot on `http://localhost:3000`.

### 5. API Documentation
Navigate to [http://localhost:3000/api-docs](http://localhost:3000/api-docs) to interact with endpoints via Swagger UI.

### 6. Running Tests
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

### AI Meeting Analysis
* **Trigger Analysis**: `POST /api/meetings/:id/analyze`
  * Interacts with Groq API, validates structure with Zod, checks citation timestamps against actual transcript segments in the database, saves findings, and automatically populates the `ActionItem` table.

### Action Item Management
* **Get Overdue Action Items**: `GET /api/action-items/overdue`
  * Fetches items with `dueDate` in the past and status != `COMPLETED`.
* **Update status**: `PATCH /api/action-items/:id/status`
  * Enforces linear status transitions: `PENDING` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`.

---

## Deployment Instructions

### Deploying on Render
1. **Create a New Web Service**:
   - Connect your GitHub repository to Render.
   - Choose **Node** as the runtime.
2. **Database Provisioning**:
   - Create a PostgreSQL database instance in the Render dashboard.
   - Copy the database's **Internal Database URL**.
3. **Configure Build & Start Settings**:
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma migrate deploy && npm start
     ```
4. **Configure Environment Variables**:
   Add the following variables in the **Environment** section:
   - `DATABASE_URL`: Set to the PostgreSQL Internal Database URL.
   - `JWT_SECRET`: A secure signing token.
   - `GROQ_API_KEY`: Your Groq Cloud API key.
   - `RESEND_API_KEY`: Your Resend API key for email notifications.
   - `SENDER_EMAIL`: The verified domain sender email configured in Resend.
   - Other metadata keys (`CANDIDATE_NAME`, `CANDIDATE_EMAIL`, etc.).

### Deploying on Railway
1. **Create a New Project**:
   - Connect your GitHub repository to Railway.
2. **Database Provisioning**:
   - Add a PostgreSQL plugin to your Railway project. Railway will automatically inject the `DATABASE_URL` environment variable.
3. **Configure Build & Start Commands**:
   - Prepend database migrations before booting the server:
     `npx prisma migrate deploy && npm start`
