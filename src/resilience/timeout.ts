/**
 * Wraps a promise in a timeout.
 * If the promise doesn't resolve within `ms` milliseconds, it rejects
 * with a TimeoutError.
 *
 * We use this in the resilience layer rather than Axios's built-in timeout
 * so we have a single consistent timeout mechanism regardless of transport.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}
