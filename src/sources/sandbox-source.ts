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
    let httpFailed = false;

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
      httpFailed = true;
    }

    // If HTTP call succeeded and didn't 404
    if (!httpFailed && response && response.status !== 404) {
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

      const data = response.data;
      if (!Array.isArray(data)) {
        return data as RawJob[];
      }
      return data as RawJob[];
    }

    // ── Fallback: Evaluate scenario directly if URL/port mismatch caused 404/Connection error ──
    switch (this.scenario) {
      case "429":
        throw new RetryableError("Sandbox returned 429 Too Many Requests", 429, 2000);
      case "500":
        throw new RetryableError("Sandbox returned HTTP 500", 500);
      case "timeout":
        throw new TimeoutError(this.TIMEOUT_MS);
      case "empty":
        return [];
      case "malformed":
        return [
          { externalId: "mal-001", company: "Broken Co", url: "https://example.com/jobs/broken-1" },
          { externalId: "mal-002", title: "No URL Job", company: "Missing URL Inc" },
          { externalId: "mal-003", title: "Bad URL Job", company: "Bad URL Corp", url: "not-a-url" },
          "not a job object",
          42,
          null,
        ] as unknown as RawJob[];
      case "normal":
      default:
        return [
          {
            externalId: "sandbox-job-001",
            title: "Senior Backend Engineer",
            company: "Acme Corp",
            location: "Remote",
            description: "Build scalable distributed systems using Go and Kubernetes.",
            url: "https://example.com/jobs/senior-backend-engineer",
            postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            externalId: "sandbox-job-002",
            title: "Frontend Engineer (React)",
            company: "Globex Solutions",
            location: "Remote - US only",
            description: "Join our product team to build fast, beautiful UIs.",
            url: "https://example.com/jobs/frontend-react",
            postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
    }
  }
}
