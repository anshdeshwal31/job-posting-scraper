/**
 * Calculate the delay before the next retry attempt using
 * exponential backoff with full jitter.
 *
 * Formula: min(cap, base * 2^attempt) * random(0, 1)
 *
 * Full jitter avoids synchronized retry storms when multiple
 * ingestion workers (or future scheduled runs) retry simultaneously.
 *
 * Reference: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */

export interface BackoffOptions {
  baseMs?: number;   // base delay in ms (default: 1000)
  capMs?: number;    // maximum delay in ms (default: 30_000)
  attempt: number;   // 0-indexed attempt number
}

export function calculateBackoffMs(options: BackoffOptions): number {
  const base = options.baseMs ?? 1_000;
  const cap = options.capMs ?? 30_000;
  const { attempt } = options;

  // Exponential ceiling with cap
  const ceiling = Math.min(cap, base * Math.pow(2, attempt));
  // Full jitter: random in [0, ceiling]
  return Math.floor(Math.random() * ceiling);
}

/**
 * Sleep for `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
