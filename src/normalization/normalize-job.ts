import { NormalizedJob } from "@/src/ingestion/types";
import { ValidatedRawJob } from "@/src/validation/job-schema";

/**
 * Converts a validated raw job into our internal NormalizedJob representation.
 *
 * This is the only place source-specific field mapping lives.
 * The ingestion engine works exclusively with NormalizedJob objects.
 *
 * Note: We do NOT fabricate data. If a field isn't present in the source,
 * it stays undefined. We only transform/coerce what's actually there.
 */
export function normalizeJob(
  raw: ValidatedRawJob,
  source: string,
  fetchedAt: Date
): NormalizedJob {
  return {
    source,
    externalId: raw.externalId,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    description: raw.description,
    url: raw.url,
    postedAt: raw.postedAt ? new Date(raw.postedAt) : undefined,
    fetchedAt,
  };
}
