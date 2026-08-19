# Acdyon Job Ingestion

> Production-minded job ingestion pipeline with resilience, deduplication, and observability.

**Live Demo:** _[Add URL after Vercel deployment]_

---

## Problem Being Solved

Public job boards expose data via RSS/JSON APIs. Ingesting that data reliably requires handling:

- Transient source failures (429 rate limits, 5xx errors, network timeouts)
- Duplicate jobs across repeated ingestion runs
- Malformed or schema-violating records from external sources
- Suspicious empty responses that could silently destroy stored data
- Concurrent ingestion attempts from multiple triggers

This application demonstrates a production-grade solution to all of the above.

---

## Architecture

```
Dashboard (Next.js)
        │
        ├── POST /api/ingestion/run ──→ Concurrent guard ──→ Inngest event
        │                                                          │
        │                                                    Ingestion Engine
        │                                                          │
        │                                                     JobSource
        │                                                    /          \
        │                                             RemoteOK       Sandbox
        │                                            (real API)    (local routes)
        │                                                    \          /
        │                                                     Resilience
        │                                                    (retry + backoff)
        │                                                          │
        │                                                       Zod validation
        │                                                          │
        │                                                      Normalize
        │                                                          │
        │                                                     Deduplicate
        │                                                  (unique constraint)
        │                                                          │
        │                                                    Neon PostgreSQL
        │                                                    (via Prisma)
        │
        └── GET /api/stats, /api/runs, /api/jobs ──→ Dashboard renders
```

**Key boundary:** The dashboard has zero business logic. All ingestion behavior lives in `src/`.

---

## Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| **RemoteOK JSON API** | Free, public, no auth, no anti-bot, stable structure |
| **Inngest** | Background execution, function observability, future scheduling without changes |
| **Zod validation** | Explicit schema boundary between external data and database |
| **`createMany` + `skipDuplicates`** | Deduplication at DB level via `@@unique([source, externalId])` |
| **Suspicious-empty guard** | If source returns [] but DB has jobs, we skip upsert and flag the anomaly |
| **RetryableError / PermanentError** | Explicit error hierarchy — retry policy derived from error type, not HTTP status alone |
| **Full jitter backoff** | Prevents synchronized retry storms from multiple concurrent callers |
| **Vercel deployment** | Zero-config for Next.js, instant deploys, pairs with Neon and Inngest |

---

## Failure Handling

| Scenario | Behavior |
|----------|----------|
| HTTP 429 | Retry with exponential backoff + respect `Retry-After` header |
| HTTP 5xx | Retry up to 4 total attempts |
| Network timeout | Retry; after exhaustion → run marked FAILED |
| Retry exhaustion | Run marked FAILED, error recorded, existing DB data untouched |
| Empty response (DB has jobs) | Suspicious → skip upsert, mark FAILED with explanation |
| Malformed data | Zod rejects individual records; valid records still processed |
| Concurrent ingestion | Second trigger returns existing run ID/status (no duplicate fetch) |

---

## Running Locally

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- An [Inngest](https://app.inngest.com) account

### Setup

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/acdyon-job-ingestion
cd acdyon-job-ingestion
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL, DIRECT_URL, and Inngest keys

# 3. Push database schema
npm run db:push

# 4. Start the dev server
npm run dev

# 5. In a second terminal, start the Inngest Dev Server
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Visit http://localhost:3000 → redirects to `/dashboard`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon connection string (with `pgbouncer=true` for pooling) |
| `DIRECT_URL` | ✅ | Neon direct URL (for Prisma migrations, bypasses PgBouncer) |
| `INNGEST_SIGNING_KEY` | ✅ (prod) | From Inngest dashboard |
| `INNGEST_EVENT_KEY` | ✅ (prod) | From Inngest dashboard |
| `NEXT_PUBLIC_APP_URL` | Optional | Full URL for sandbox self-calls (auto-set by Vercel) |

---

## Running Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
npm run test:watch       # Watch mode
```

Tests cover:

- Zod validation (valid, minimal, invalid shapes)
- Retry logic (success, recovery, exhaustion, no-retry on permanent errors)
- Ingestion engine (success, deduplication, malformed rejection, empty guard, retry recovery, fetch failure)

---

## Demonstrating Failure Modes

On the dashboard, scroll to the **Failure Testing** section. The five buttons are:

| Button | What it does |
|--------|-------------|
| Test Rate Limit | Triggers ingestion against `/api/sandbox/jobs/429` → engine retries with backoff |
| Test Server Error | Triggers against `/api/sandbox/jobs/500` → engine retries → FAILED after exhaustion |
| Test Timeout | Against `/api/sandbox/jobs/timeout` (35s delay, 10s client timeout) → TimeoutError → FAILED |
| Test Empty Response | Against `/api/sandbox/jobs/empty` → engine detects suspicious empty if DB has jobs |
| Test Malformed Data | Against `/api/sandbox/jobs/malformed` → Zod rejects all records → rejected count shown |

Watch the **Recent Ingestion Runs** panel update after each test.

---

## Deployment

Deployed on **Vercel** with Neon PostgreSQL and Inngest.

```bash
# Push to GitHub → connect repo in Vercel dashboard
# Set environment variables in Vercel Project Settings
# Vercel automatically runs `npm run build` on each push
```

After first deploy:
1. Run `npm run db:migrate` (or `db:push` for dev) against your Neon DB
2. In Inngest dashboard → Apps → Sync → enter your Vercel URL + `/api/inngest`

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| ORM | Prisma |
| Database | Neon PostgreSQL |
| Background jobs | Inngest |
| Validation | Zod |
| HTTP client | Axios |
| Testing | Jest + ts-jest |
| Deployment | Vercel |

---

## Known Limitations / Future Improvements

- **Scheduling:** Manual ingestion only (by design for the demo). Adding `cron: "0 */6 * * *"` to the Inngest function config enables scheduled runs with zero code changes.
- **Multiple sources:** Adding a second source requires only a new file in `src/sources/`. The engine is source-agnostic.
- **Observability:** Structured logging (Pino/Winston) and Prometheus metrics could replace the current DB-based event log.
- **Test coverage:** API route integration tests and source adapter tests could be added with MSW.
- **Pagination in runs table:** Currently capped at 10 most recent runs.
