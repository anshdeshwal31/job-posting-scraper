import { serve } from "inngest/next";
import { inngest } from "@/src/inngest/client";
import { ingestJobsFunction } from "@/src/inngest/functions/ingest-jobs";

/**
 * Inngest serve handler.
 * This endpoint is used by Inngest to:
 * - Discover registered functions (GET)
 * - Deliver function invocations (POST)
 * - Probe health (PUT)
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestJobsFunction],
});
