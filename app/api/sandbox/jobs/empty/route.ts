import { NextResponse } from "next/server";

/**
 * GET /api/sandbox/jobs/empty
 * Returns HTTP 200 with an empty array.
 * The ingestion engine detects this and checks for existing data:
 * - If existing jobs exist → marks run as FAILED with SuspiciousEmptyResponseError
 * - If no existing jobs → marks run as SUCCESS with 0 fetched
 */
export async function GET() {
  return NextResponse.json([]);
}
