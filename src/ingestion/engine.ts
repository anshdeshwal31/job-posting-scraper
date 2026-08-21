import { prisma } from "@/src/db/prisma";
import { JobSource } from "@/src/sources/job-source";
import { RemoteOKSource } from "@/src/sources/real-source";
import { SandboxSource } from "@/src/sources/sandbox-source";
import { validateJob } from "@/src/validation/job-schema";
import { normalizeJob } from "@/src/normalization/normalize-job";
import { withRetry } from "@/src/resilience/retry";
import {
  RetryExhaustedError,
  SuspiciousEmptyResponseError,
} from "@/src/ingestion/errors";
import type { IngestionOptions, IngestionResult } from "@/src/ingestion/types";
import { RunStatus, EventType } from "@prisma/client";

/**
 * The ingestion engine.
 *
 * Responsibilities:
 * 1. Select the correct source based on options
 * 2. Fetch jobs with resilience (retry + backoff)
 * 3. Validate each job with Zod
 * 4. Protect against suspicious empty responses
 * 5. Normalize valid jobs
 * 6. Upsert into the database (deduplication via unique constraint)
 * 7. Record all events and update the run record
 *
 * The engine has NO knowledge of whether it's running via Inngest,
 * an HTTP handler, or a test. It only knows about sources and the database.
 */
export async function runIngestionEngine(
  options: IngestionOptions
): Promise<IngestionResult> {
  const { runId } = options;

  // ── Mark run as RUNNING ───────────────────────────────────────────────────
  await prisma.ingestionRun.update({
    where: { id: runId },
    data: { status: RunStatus.RUNNING, startedAt: new Date() },
  });

  // ── Select source ─────────────────────────────────────────────────────────
  const source: JobSource =
    options.source === "sandbox"
      ? new SandboxSource(options.scenario ?? "normal")
      : new RemoteOKSource();

  const fetchedAt = new Date();
  let retries = 0;
  let rawJobs: unknown[] = [];
  let fetchError: Error | undefined;

  // ── Fetch with retry/backoff ───────────────────────────────────────────────
  try {
    const { result, retries: r } = await withRetry(
      () => source.fetchJobs(),
      {
        maxAttempts: 4,
        baseMs: 1_000,
        capMs: 30_000,
        onRetry: async (attempt, error, delayMs) => {
          await prisma.ingestionEvent.create({
            data: {
              runId,
              type: EventType.RETRY,
              message: `Attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms.`,
            },
          });
        },
      }
    );
    rawJobs = Array.isArray(result) ? result : [result];
    retries = r;
  } catch (err) {
    fetchError = err as Error;
    if (err instanceof RetryExhaustedError) {
      retries = Math.max(0, err.attempts - 1);
    }
    await prisma.ingestionEvent.create({
      data: {
        runId,
        type: EventType.ERROR,
        message: `Fetch failed permanently: ${fetchError.message}`,
      },
    });
  }

  // ── Handle fetch failure ──────────────────────────────────────────────────
  if (fetchError) {
    await prisma.ingestionRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        completedAt: new Date(),
        retries,
        errorMessage: fetchError.message,
      },
    });
    return {
      runId,
      status: "FAILED",
      jobsFetched: 0,
      jobsInserted: 0,
      duplicates: 0,
      rejected: 0,
      retries,
      errorMessage: fetchError.message,
    };
  }

  const jobsFetched = rawJobs.length;

  // ── Suspicious empty response guard ──────────────────────────────────────
  if (jobsFetched === 0) {
    const existingCount = await prisma.job.count({
      where: { source: source.name },
    });

    if (existingCount > 0) {
      const emptyErr = new SuspiciousEmptyResponseError(existingCount);
      await prisma.ingestionEvent.create({
        data: {
          runId,
          type: EventType.WARNING,
          message: emptyErr.message,
        },
      });
      await prisma.ingestionRun.update({
        where: { id: runId },
        data: {
          status: RunStatus.FAILED,
          completedAt: new Date(),
          retries,
          jobsFetched: 0,
          errorMessage: emptyErr.message,
        },
      });
      return {
        runId,
        status: "FAILED",
        jobsFetched: 0,
        jobsInserted: 0,
        duplicates: 0,
        rejected: 0,
        retries,
        errorMessage: emptyErr.message,
      };
    }

    // Legitimately empty source (no existing jobs)
    await prisma.ingestionEvent.create({
      data: {
        runId,
        type: EventType.INFO,
        message: "Source returned 0 jobs. No existing jobs to protect.",
      },
    });
    await prisma.ingestionRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.SUCCESS,
        completedAt: new Date(),
        retries,
        jobsFetched: 0,
        jobsInserted: 0,
        duplicates: 0,
        rejected: 0,
      },
    });
    return {
      runId,
      status: "SUCCESS",
      jobsFetched: 0,
      jobsInserted: 0,
      duplicates: 0,
      rejected: 0,
      retries,
    };
  }

  // ── Validate + normalize ──────────────────────────────────────────────────
  const validJobs: ReturnType<typeof normalizeJob>[] = [];
  let rejected = 0;

  for (const raw of rawJobs) {
    const validation = validateJob(raw);
    if (validation.success) {
      validJobs.push(normalizeJob(validation.data, source.name, fetchedAt));
    } else {
      rejected++;
      await prisma.ingestionEvent.create({
        data: {
          runId,
          type: EventType.WARNING,
          message: `Job rejected: ${validation.error}`,
        },
      });
    }
  }

  // ── Upsert with deduplication ─────────────────────────────────────────────
  // Prisma createMany with skipDuplicates leverages the @@unique([source, externalId])
  // constraint to silently skip already-stored jobs.
  const beforeCount = await prisma.job.count({ where: { source: source.name } });

  await prisma.job.createMany({
    data: validJobs,
    skipDuplicates: true,
  });

  const afterCount = await prisma.job.count({ where: { source: source.name } });
  const jobsInserted = afterCount - beforeCount;
  const duplicates = validJobs.length - jobsInserted;

  // ── Determine final status ────────────────────────────────────────────────
  // RECOVERED = fetch required retries but ultimately succeeded
  const finalStatus: RunStatus = retries > 0 ? RunStatus.RECOVERED : RunStatus.SUCCESS;

  await prisma.ingestionRun.update({
    where: { id: runId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      jobsFetched,
      jobsInserted,
      duplicates,
      rejected,
      retries,
    },
  });

  await prisma.ingestionEvent.create({
    data: {
      runId,
      type: EventType.INFO,
      message: `Ingestion complete. Fetched: ${jobsFetched}, Inserted: ${jobsInserted}, Duplicates: ${duplicates}, Rejected: ${rejected}`,
    },
  });

  return {
    runId,
    status: finalStatus === RunStatus.RECOVERED ? "RECOVERED" : "SUCCESS",
    jobsFetched,
    jobsInserted,
    duplicates,
    rejected,
    retries,
  };
}
