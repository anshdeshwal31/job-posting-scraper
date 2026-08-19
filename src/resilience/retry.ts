import { RetryableError, RetryExhaustedError } from "@/src/ingestion/errors";
import { calculateBackoffMs, sleep } from "./backoff";

export interface RetryOptions {
  maxAttempts?: number; // total attempts including the first (default: 4)
  baseMs?: number;      // backoff base in ms (default: 1000)
  capMs?: number;       // max backoff in ms (default: 30_000)
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Wraps an async function with retry + exponential backoff.
 *
 * Retry policy:
 * - WILL retry: RetryableError (covers HTTP 429, 5xx, timeouts, network errors)
 * - WILL NOT retry: Any other error (PermanentError, validation failures, etc.)
 *
 * If a RetryableError carries a `retryAfterMs` (from a 429 Retry-After header),
 * that delay is respected instead of the computed backoff.
 *
 * Returns the number of retries performed alongside the result so the
 * ingestion engine can record it.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<{ result: T; retries: number }> {
  const maxAttempts = options.maxAttempts ?? 4;
  let lastError: Error = new Error("Unknown error");
  let retries = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, retries };
    } catch (err) {
      lastError = err as Error;

      // Only retry on RetryableError
      if (!(err instanceof RetryableError)) {
        throw err;
      }

      // No more attempts left — fall through to throw
      if (attempt === maxAttempts - 1) {
        break;
      }

      retries++;

      // Respect Retry-After if provided (e.g. from 429 response)
      let delayMs: number;
      if ((err as RetryableError).retryAfterMs !== undefined) {
        delayMs = (err as RetryableError).retryAfterMs!;
      } else {
        delayMs = calculateBackoffMs({
          attempt,
          baseMs: options.baseMs,
          capMs: options.capMs,
        });
      }

      options.onRetry?.(attempt + 1, err, delayMs);

      await sleep(delayMs);
    }
  }

  throw new RetryExhaustedError(maxAttempts, lastError);
}
