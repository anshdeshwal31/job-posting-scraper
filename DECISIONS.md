# DECISIONS.md

## 1. Why this ingestion strategy?

I used a **pull-based JSON API** (RemoteOK) rather than a push-based webhook or a scraper. The alternative was scraping a site like LinkedIn, but those require bypassing anti-bot controls — explicitly prohibited by the brief and ethically wrong. RemoteOK exposes a free, publicly documented JSON API with no authentication required and a reasonable rate limit for demo polling. The pull model also fits naturally with the manual-trigger-first approach: one button → one HTTP request → one database write.

The source is isolated behind a `JobSource` interface, so switching to the Plan B source (Arbeitnow's free API at `https://www.arbeitnow.com/api/job-board-api`) requires writing a ~30-line adapter file. The ingestion engine, validation, normalization, and database layers need zero changes.

## 2. One trade-off made under the time limit

**Trade-off:** The deduplication strategy uses a database-level `@@unique([source, externalId])` constraint with Prisma's `createMany + skipDuplicates`. This is correct and robust for a single-source pipeline. However, it doesn't handle the case where the same job appears across two *different* sources (e.g., a job on RemoteOK and Arbeitnow is the same real position). Cross-source deduplication would require content-based fingerprinting (title + company + URL hash), which adds meaningful complexity.

**With a real week:** I would add a content fingerprint column (`contentHash`) computed from normalized `(title, company, url)` and use it as a secondary uniqueness signal. The current architecture makes this a non-breaking additive migration.

## 3. Where AI tools were used

I used an AI assistant to accelerate scaffolding and draft initial implementations of the retry logic, Zod schema, and CSS design system.

What I personally verified and changed:
- The retry loop: I confirmed it correctly distinguishes `RetryableError` from `PermanentError` and that the `retryAfterMs` path is exercised by the 429 sandbox route.
- The empty-response guard: The AI initially placed this check after validation, which would have made it useless for the malformed scenario. I moved it to run against raw job count before validation.
- The Inngest concurrency key: The first draft used a global `limit: 1` which would have blocked all sources if sandbox and real ran concurrently. I changed it to `key: "event.data.source"` so each source has its own concurrency budget.
- All test cases: Written to test actual behavior described in the brief, not just happy paths.
