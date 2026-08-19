import { NextResponse } from "next/server";

/**
 * GET /api/sandbox/jobs/500
 * Simulates an internal server error from the job source.
 * The ingestion engine retries this as a transient failure.
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: "Internal Server Error" }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}
