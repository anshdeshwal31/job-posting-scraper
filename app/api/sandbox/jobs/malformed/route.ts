import { NextResponse } from "next/server";

/**
 * GET /api/sandbox/jobs/malformed
 * Returns HTTP 200 with structurally invalid job data.
 * The Zod validation layer rejects these; none reach the database.
 */
export async function GET() {
  return NextResponse.json([
    // Missing required title
    {
      externalId: "mal-001",
      company: "Broken Co",
      url: "https://example.com/jobs/broken-1",
    },
    // Missing required url
    {
      externalId: "mal-002",
      title: "No URL Job",
      company: "Missing URL Inc",
    },
    // Invalid URL format
    {
      externalId: "mal-003",
      title: "Bad URL Job",
      company: "Bad URL Corp",
      url: "not-a-url",
    },
    // Missing externalId
    {
      title: "No ID Job",
      company: "No ID Ltd",
      url: "https://example.com/jobs/no-id",
    },
    // Completely wrong shape
    "this is not a job object at all",
    42,
    null,
  ]);
}
