import { NextResponse } from "next/server";

/**
 * GET /api/sandbox/jobs/timeout
 * Deliberately delays the response beyond the client's timeout threshold.
 * The sandbox source uses a 10s timeout; this waits 35s.
 * The ingestion engine handles the resulting TimeoutError via retry.
 */
export async function GET() {
  // Wait 35 seconds — well past the 10s client timeout
  await new Promise((resolve) => setTimeout(resolve, 35_000));
  return NextResponse.json({ error: "This response was intentionally delayed" });
}

// Increase the route segment timeout to allow the delay
export const maxDuration = 60;
