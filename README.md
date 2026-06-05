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

Copy the `.env.example` file to `.env` in the root folder and fill in your actual credentials:

```bash
cp .env.example .env
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

## Deployment Instructions (Render)

Follow these instructions to deploy the application on **Render**:

1. **Create a New Web Service**:
   - Connect your GitHub repository to Render.
   - Choose **Node** as the runtime.

2. **Configure Build & Start Settings**:
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma db push && npm start
     ```

3. **Configure Environment Variables**:
   Add the following variables in the **Environment** section of your Render settings:
   - `PORT`: The port the server should run on (e.g. `3000`, Render will automatically assign this if omitted).
   - `NODE_ENV`: Set to `production`.
   - `DATABASE_URL`: Set to `file:./dev.db` (for SQLite local storage).
   - `JWT_SECRET`: A secure random string used to sign JWT session tokens.
   - `GROQ_API_KEY`: Your Groq Cloud API key.
   - `GROQ_MODEL`: The Groq model to run (e.g., `llama-3.3-70b-versatile`).
   - `RESEND_API_KEY`: Your Resend API key for email notifications.
   - `SENDER_EMAIL`: The verified domain sender email configured in Resend (e.g., `notifications@yourdomain.com`).
   - `CANDIDATE_NAME`: Your name.
   - `CANDIDATE_EMAIL`: Your contact email.
   - `REPOSITORY_URL`: The URL of your GitHub repository.
   - `DEPLOYED_URL`: The live URL assigned by Render (e.g., `https://your-service.onrender.com`).

4. **Persistence (Optional)**:
   - Since the application uses SQLite, any writes to `dev.db` will be wiped on redeployment or restart unless you mount a persistent disk volume on Render (e.g., at `/opt/render/project/src/prisma/` or another location, updating `DATABASE_URL` path accordingly).
   - Alternatively, you can change the provider in `prisma/schema.prisma` to `postgresql` and link it to a Render PostgreSQL instance for full data durability.

