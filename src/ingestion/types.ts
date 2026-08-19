// ─── Raw job as returned by any source before validation ─────────────────────

export interface RawJob {
  externalId: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  url: string;
  postedAt?: string; // ISO string or null
}

// ─── Validated + normalized job ready for persistence ────────────────────────

export interface NormalizedJob {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  url: string;
  postedAt?: Date;
  fetchedAt: Date;
}

// ─── Options passed into the ingestion engine ────────────────────────────────

export type SourceType = "remoteok" | "sandbox";
export type SandboxScenario =
  | "normal"
  | "429"
  | "500"
  | "timeout"
  | "empty"
  | "malformed";

export interface IngestionOptions {
  source: SourceType;
  scenario?: SandboxScenario; // only relevant when source === "sandbox"
  runId: string; // pre-created IngestionRun id
}

// ─── Result returned by the ingestion engine ─────────────────────────────────

export interface IngestionResult {
  runId: string;
  status: "SUCCESS" | "RECOVERED" | "FAILED";
  jobsFetched: number;
  jobsInserted: number;
  duplicates: number;
  rejected: number;
  retries: number;
  errorMessage?: string;
}
