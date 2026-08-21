import axios, { AxiosError } from "axios";
import { JobSource } from "./job-source";
import { RawJob } from "@/src/ingestion/types";
import { PermanentError, RetryableError } from "@/src/ingestion/errors";

/**
 * RemoteOK public JSON API adapter.
 *
 * Endpoint: https://remoteok.com/api
 * Auth: none required
 * Rate limit: liberal for reasonable polling intervals
 * License: public API, no scraping/bypassing required
 *
 * Plan B: If RemoteOK becomes unavailable, swap this adapter for
 * ArbeitnowSource (src/sources/arbeitnow-source.ts) which uses
 * https://www.arbeitnow.com/api/job-board-api — same interface,
 * zero changes to the ingestion engine.
 */
export class RemoteOKSource implements JobSource {
  readonly name = "remoteok";

  private readonly BASE_URL = "https://remoteok.com/api";
  private readonly TIMEOUT_MS = 15_000;

  async fetchJobs(): Promise<RawJob[]> {
    let response;
    try {
      response = await axios.get(this.BASE_URL, {
        timeout: this.TIMEOUT_MS,
        headers: {
          // RemoteOK requests a descriptive User-Agent
          "User-Agent": "acdyon-job-ingestion/1.0 (assessment project)",
          Accept: "application/json",
        },
        validateStatus: (status) => status < 600,
      });
    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.code === "ECONNABORTED" || axErr.code === "ETIMEDOUT") {
        throw new RetryableError(
          `RemoteOK request timed out after ${this.TIMEOUT_MS}ms`,
          undefined
        );
      }
      if (axErr.code === "ECONNREFUSED" || axErr.code === "ENOTFOUND") {
        throw new RetryableError(`Network error reaching RemoteOK: ${axErr.message}`);
      }
      throw new RetryableError(`Unexpected network error: ${axErr.message}`);
    }

    const status = response.status;

    if (status === 429) {
      const retryAfter = response.headers["retry-after"];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      throw new RetryableError("RemoteOK returned 429 Too Many Requests", 429, retryAfterMs);
    }

    if (status >= 500) {
      throw new RetryableError(`RemoteOK returned HTTP ${status}`, status);
    }

    if (status >= 400) {
      throw new PermanentError(`RemoteOK returned HTTP ${status}`, status);
    }

    // RemoteOK prepends a metadata object as the first array element
    const raw = response.data;
    if (!Array.isArray(raw)) {
      throw new PermanentError("RemoteOK returned a non-array response");
    }

    // Skip the first element (it's API metadata, not a job)
    const jobs = raw.slice(1);

    return jobs
      .filter((item: unknown) => item && typeof item === "object")
      .map((item: Record<string, unknown>) => ({
        externalId: String(item["id"] ?? item["slug"] ?? ""),
        title: String(item["position"] ?? item["title"] ?? ""),
        company: String(item["company"] ?? ""),
        location: item["location"] ? String(item["location"]) : "Remote",
        description: item["description"] ? String(item["description"]) : undefined,
        url: String(item["url"] ?? `https://remoteok.com/remote-jobs/${item["slug"] ?? item["id"]}`),
        postedAt: item["date"] ? String(item["date"]) : undefined,
      }))
      .filter((j) => j.externalId && j.title && j.company && j.url)
      .slice(0, 30); // Cap at 30 items per ingestion batch
  }
}
