import { RawJob } from "@/src/ingestion/types";

/**
 * Every job source must implement this interface.
 * The ingestion engine only knows about this abstraction —
 * it has no knowledge of whether the underlying source is
 * RSS, JSON, XML, or a sandbox fixture.
 */
export interface JobSource {
  /** Human-readable name used for logging and run records */
  readonly name: string;

  /**
   * Fetch raw jobs from this source.
   * Must return an array of RawJob objects.
   * May throw RetryableError or PermanentError from src/ingestion/errors.ts.
   */
  fetchJobs(): Promise<RawJob[]>;
}
