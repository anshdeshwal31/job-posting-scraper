import { withRetry } from "@/src/resilience/retry";
import { RetryableError, PermanentError, RetryExhaustedError } from "@/src/ingestion/errors";

// Override sleep to avoid real delays in tests
jest.mock("@/src/resilience/backoff", () => ({
  calculateBackoffMs: () => 0,
  sleep: () => Promise.resolve(),
}));

describe("withRetry", () => {
  it("returns result immediately on success (no retries)", async () => {
    const fn = jest.fn().mockResolvedValue("hello");
    const { result, retries } = await withRetry(fn, { maxAttempts: 4 });
    expect(result).toBe("hello");
    expect(retries).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on RetryableError and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError("429", 429))
      .mockResolvedValue("ok");

    const { result, retries } = await withRetry(fn, { maxAttempts: 4 });
    expect(result).toBe("ok");
    expect(retries).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 and succeeds after two failures", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError("500", 500))
      .mockRejectedValueOnce(new RetryableError("500", 500))
      .mockResolvedValue("recovered");

    const { result, retries } = await withRetry(fn, { maxAttempts: 4 });
    expect(result).toBe("recovered");
    expect(retries).toBe(2);
  });

  it("throws RetryExhaustedError after all attempts fail", async () => {
    const fn = jest.fn().mockRejectedValue(new RetryableError("always fails", 500));

    await expect(withRetry(fn, { maxAttempts: 4 })).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("does NOT retry on PermanentError", async () => {
    const fn = jest.fn().mockRejectedValue(new PermanentError("400 Bad Request", 400));

    await expect(withRetry(fn, { maxAttempts: 4 })).rejects.toThrow(PermanentError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on non-IngestionError (e.g. programming errors)", async () => {
    const fn = jest.fn().mockRejectedValue(new TypeError("cannot read properties of undefined"));

    await expect(withRetry(fn, { maxAttempts: 4 })).rejects.toThrow(TypeError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry callback with correct attempt number", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError("err"))
      .mockResolvedValue("done");

    const onRetry = jest.fn();
    await withRetry(fn, { maxAttempts: 4, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(RetryableError), expect.any(Number));
  });

  it("respects retryAfterMs from RetryableError", async () => {
    // backoff is mocked to 0, but retryAfterMs should be passed to onRetry
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError("429", 429, 5000))
      .mockResolvedValue("ok");

    const onRetry = jest.fn();
    await withRetry(fn, { maxAttempts: 4, onRetry });
    // delayMs passed to onRetry should be the retryAfterMs (5000), not backoff (0)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(RetryableError), 5000);
  });
});
