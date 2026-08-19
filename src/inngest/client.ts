import { Inngest } from "inngest";

/**
 * Inngest client — the single instance used throughout the application.
 * The client is identified by "acdyon-job-ingestion" which appears in
 * the Inngest dashboard.
 */
export const inngest = new Inngest({ id: "acdyon-job-ingestion" });
