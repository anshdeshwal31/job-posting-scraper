// ─── Custom error hierarchy for the ingestion pipeline ───────────────────────

/**
 * Base class for all ingestion errors.
 */
export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionError";
  }
}

/**
 * Thrown for transient failures that SHOULD be retried:
 * HTTP 429, HTTP 5xx, network timeouts, ECONNREFUSED, etc.
 */
export class RetryableError extends IngestionError {
  public readonly statusCode?: number;
  public readonly retryAfterMs?: number;

  constructor(
    message: string,
    statusCode?: number,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = "RetryableError";
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown for permanent failures that should NOT be retried:
 * HTTP 400, 401, 403, 404, etc.
 */
export class PermanentError extends IngestionError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "PermanentError";
    this.statusCode = statusCode;
  }
}

/**
 * Thrown when the source returns an empty job list and we have
 * existing jobs in the database (suspicious empty response).
 */
export class SuspiciousEmptyResponseError extends IngestionError {
  public readonly existingJobCount: number;

  constructor(existingJobCount: number) {
    super(
      `Source returned 0 jobs but database already contains ${existingJobCount} jobs. ` +
        "Skipping upsert to protect existing data."
    );
    this.name = "SuspiciousEmptyResponseError";
    this.existingJobCount = existingJobCount;
  }
}

/**
 * Thrown when request exceeds the configured timeout.
 */
export class TimeoutError extends RetryableError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Thrown when all retry attempts are exhausted.
 */
export class RetryExhaustedError extends IngestionError {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(
      `All ${attempts} retry attempts exhausted. Last error: ${lastError.message}`
    );
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}
