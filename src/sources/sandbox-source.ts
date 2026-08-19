import axios, { AxiosError } from "axios";
import { JobSource } from "./job-source";
import { RawJob, SandboxScenario } from "@/src/ingestion/types";
import { PermanentError, RetryableError, TimeoutError } from "@/src/ingestion/errors";

/**
 * Sandbox source adapter.
 *
 * Routes requests to the local sandbox API endpoints:
 *   /api/sandbox/jobs          → normal (200 + valid data)
 *   /api/sandbox/jobs/429      → 429
 *   /api/sandbox/jobs/500      → 500
 *   /api/sandbox/jobs/timeout  → delayed beyond client timeout
 *   /api/sandbox/jobs/empty    → 200 + []
 *   /api/sandbox/jobs/malformed → 200 + structurally invalid data
 *
 * This source exists for deterministic engineering demonstrations.
 * All resilience behavior lives in the ingestion engine, NOT here.
 */
export class SandboxSource implements JobSource {
  readonly name: string;
  private readonly scenario: SandboxScenario;
  private readonly baseUrl: string;
  private readonly TIMEOUT_MS = 10_000;

  constructor(scenario: SandboxScenario = "normal", baseUrl?: string) {
    this.scenario = scenario;
    this.name = `sandbox-${scenario}`;
    // Allow override for testing; default to localhost
    this.baseUrl = baseUrl ?? (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  }

  async fetchJobs(): Promise<RawJob[]> {
    const path =
      this.scenario === "normal"
        ? "/api/sandbox/jobs"
        : `/api/sandbox/jobs/${this.scenario}`;

    const url = `${this.baseUrl}${path}`;

    let response;
    try {
      response = await axios.get(url, {
        timeout: this.TIMEOUT_MS,
        validateStatus: (status) => status < 600,
      });
    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.code === "ECONNABORTED" || axErr.code === "ETIMEDOUT") {
        throw new TimeoutError(this.TIMEOUT_MS);
      }
      throw new RetryableError(`Sandbox request failed: ${axErr.message}`);
    }

    const { status } = response;

    if (status === 429) {
      const retryAfter = response.headers["retry-after"];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      throw new RetryableError("Sandbox returned 429 Too Many Requests", 429, retryAfterMs);
    }

    if (status >= 500) {
      throw new RetryableError(`Sandbox returned HTTP ${status}`, status);
    }

    if (status >= 400) {
      throw new PermanentError(`Sandbox returned HTTP ${status}`, status);
    }

    // Return raw data as-is; the engine validates with Zod
    const data = response.data;
    if (!Array.isArray(data)) {
      // malformed scenario may return non-array
      return data as RawJob[];
    }
    return data as RawJob[];
  }
}
