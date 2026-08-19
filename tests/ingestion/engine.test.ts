/**
 * Ingestion engine tests.
 *
 * These tests mock Prisma and the source adapters to test the engine's
 * behavior in isolation without hitting a real database or network.
 */

import { runIngestionEngine } from "@/src/ingestion/engine";
import { prisma } from "@/src/db/prisma";
import { RetryableError } from "@/src/ingestion/errors";

// ── Mock Prisma ──────────────────────────────────────────────────────────────
jest.mock("@/src/db/prisma", () => ({
  prisma: {
    ingestionRun: {
      update: jest.fn(),
    },
    ingestionEvent: {
      create: jest.fn(),
    },
    job: {
      count: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

// ── Mock Sources ─────────────────────────────────────────────────────────────
jest.mock("@/src/sources/real-source", () => ({
  RemoteOKSource: jest.fn().mockImplementation(() => ({
    name: "remoteok",
    fetchJobs: jest.fn(),
  })),
}));

jest.mock("@/src/sources/sandbox-source", () => ({
  SandboxSource: jest.fn().mockImplementation(() => ({
    name: "sandbox-normal",
    fetchJobs: jest.fn(),
  })),
}));

// ── Mock retry to avoid real delays ─────────────────────────────────────────
jest.mock("@/src/resilience/retry", () => ({
  withRetry: jest.fn(async (fn: () => Promise<unknown>) => ({ result: await fn(), retries: 0 })),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

import { RemoteOKSource } from "@/src/sources/real-source";
import { withRetry } from "@/src/resilience/retry";

function getMockSource() {
  return (RemoteOKSource as jest.Mock).mock.results[
    (RemoteOKSource as jest.Mock).mock.results.length - 1
  ]?.value;
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.ingestionRun.update as jest.Mock).mockResolvedValue({});
  (mockPrisma.ingestionEvent.create as jest.Mock).mockResolvedValue({});
  (mockPrisma.job.createMany as jest.Mock).mockResolvedValue({ count: 0 });
});

const BASE_OPTS = { source: "remoteok" as const, runId: "run-test-1" };

const VALID_JOBS = [
  {
    externalId: "job-001",
    title: "Engineer",
    company: "Corp",
    url: "https://example.com/jobs/1",
    location: "Remote",
    postedAt: "2024-01-01T00:00:00Z",
  },
];

describe("runIngestionEngine — success path", () => {
  it("runs successfully and returns correct stats", async () => {
    (mockPrisma.job.count as jest.Mock)
      .mockResolvedValueOnce(0)  // before count
      .mockResolvedValueOnce(1); // after count

    // withRetry will call the fn and return result
    const { withRetry: wr } = require("@/src/resilience/retry");
    (wr as jest.Mock).mockImplementationOnce(async (fn: () => Promise<unknown>) => ({
      result: VALID_JOBS,
      retries: 0,
    }));

    const result = await runIngestionEngine(BASE_OPTS);

    expect(result.status).toBe("SUCCESS");
    expect(result.jobsFetched).toBe(1);
    expect(result.jobsInserted).toBe(1);
    expect(result.duplicates).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.retries).toBe(0);
  });
});

describe("runIngestionEngine — deduplication", () => {
  it("reports duplicates when count doesn't change", async () => {
    (mockPrisma.job.count as jest.Mock)
      .mockResolvedValueOnce(5)  // before
      .mockResolvedValueOnce(5); // after (nothing new)

    const { withRetry: wr } = require("@/src/resilience/retry");
    (wr as jest.Mock).mockImplementationOnce(async () => ({
      result: VALID_JOBS,
      retries: 0,
    }));

    const result = await runIngestionEngine(BASE_OPTS);

    expect(result.jobsInserted).toBe(0);
    expect(result.duplicates).toBe(1); // 1 valid job, 0 inserted → 1 dupe
  });
});

describe("runIngestionEngine — malformed data", () => {
  it("rejects invalid jobs and records them", async () => {
    const malformedJobs = [
      { externalId: "bad-1", company: "Corp" }, // missing title + url
      "not an object",
      null,
    ];

    (mockPrisma.job.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const { withRetry: wr } = require("@/src/resilience/retry");
    (wr as jest.Mock).mockImplementationOnce(async () => ({
      result: malformedJobs,
      retries: 0,
    }));

    const result = await runIngestionEngine(BASE_OPTS);

    expect(result.rejected).toBe(3);
    expect(result.jobsInserted).toBe(0);
    // ingestionEvent.create called for each rejected job + completion
    expect(mockPrisma.ingestionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "WARNING" }) })
    );
  });
});

describe("runIngestionEngine — suspicious empty response", () => {
  it("marks run FAILED and does not upsert when DB has jobs and source returns empty", async () => {
    // DB has existing jobs
    (mockPrisma.job.count as jest.Mock).mockResolvedValueOnce(500);

    const { withRetry: wr } = require("@/src/resilience/retry");
    (wr as jest.Mock).mockImplementationOnce(async () => ({
      result: [],
      retries: 0,
    }));

    const result = await runIngestionEngine(BASE_OPTS);

    expect(result.status).toBe("FAILED");
    expect(mockPrisma.job.createMany).not.toHaveBeenCalled();
    expect(result.errorMessage).toContain("500");
  });
});

describe("runIngestionEngine — retry recovery", () => {
  it("marks run RECOVERED when retries > 0 but fetch ultimately succeeds", async () => {
    (mockPrisma.job.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const { withRetry: wr } = require("@/src/resilience/retry");
    (wr as jest.Mock).mockImplementationOnce(async () => ({
      result: VALID_JOBS,
      retries: 2, // two retries needed
    }));

    const result = await runIngestionEngine(BASE_OPTS);

    expect(result.status).toBe("RECOVERED");
    expect(result.retries).toBe(2);
  });
});

describe("runIngestionEngine — fetch failure", () => {
  it("marks run FAILED when fetch exhausts all retries", async () => {
    const { withRetry: wr } = require("@/src/resilience/retry");
    (wr as jest.Mock).mockImplementationOnce(async () => {
      throw new Error("All 4 retry attempts exhausted");
    });

    const result = await runIngestionEngine(BASE_OPTS);

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toContain("exhausted");
    expect(mockPrisma.job.createMany).not.toHaveBeenCalled();
  });
});
