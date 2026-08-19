import { NextResponse } from "next/server";

/**
 * GET /api/sandbox/jobs/429
 * Simulates a rate-limit response with a Retry-After header.
 * The ingestion engine's resilience layer handles this — the UI does NOT.
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: "Too Many Requests" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "2", // 2 seconds — short enough for demo
      },
    }
  );
}
