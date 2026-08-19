import { inngest } from "@/src/inngest/client";
import { runIngestionEngine } from "@/src/ingestion/engine";
import type { IngestionOptions } from "@/src/ingestion/types";

/**
 * Inngest function: ingest/jobs.run
 *
 * In Inngest v4 the API uses 2 arguments:
 * - First arg: function config (id, name, triggers, concurrency, etc.)
 * - Second arg: the async handler
 *
 * Concurrent ingestion prevention is handled at the API route level
 * (checking for QUEUED/RUNNING runs before firing the event), so we
 * don't need Inngest-level concurrency keys here.
 *
 * Future scheduled execution can trigger this same function with
 * the same event payload without any code changes.
 */
export const ingestJobsFunction = inngest.createFunction(
  {
    id: "ingest-jobs",
    name: "Ingest Jobs",
    triggers: [{ event: "ingest/jobs.run" }],
  },
  async ({ event, step }: { event: { data: IngestionOptions }; step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const options = event.data;

    const result = await step.run("run-ingestion-engine", async () => {
      return runIngestionEngine(options);
    });

    return result;
  }
);
