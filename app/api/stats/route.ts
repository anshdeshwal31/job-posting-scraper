import { NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { RunStatus } from "@prisma/client";

/**
 * GET /api/stats
 * Returns aggregated dashboard statistics.
 */
export async function GET() {
  try {
    const [
      totalJobs,
      lastSuccessRun,
      activeRun,
      recentRuns,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.ingestionRun.findFirst({
        where: { status: { in: [RunStatus.SUCCESS, RunStatus.RECOVERED] } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.ingestionRun.findFirst({
        where: { status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] } },
        orderBy: { startedAt: "desc" },
      }),
      prisma.ingestionRun.findMany({
        take: 20,
        orderBy: { startedAt: "desc" },
      }),
    ]);

    const totalJobsInserted = recentRuns.reduce((acc, r) => acc + r.jobsInserted, 0);
    const totalDuplicates = recentRuns.reduce((acc, r) => acc + r.duplicates, 0);
    const totalRejected = recentRuns.reduce((acc, r) => acc + r.rejected, 0);
    const totalRetries = recentRuns.reduce((acc, r) => acc + r.retries, 0);

    const successStatuses: RunStatus[] = [RunStatus.SUCCESS, RunStatus.RECOVERED];
    const successCount = recentRuns.filter((r) =>
      successStatuses.includes(r.status)
    ).length;
    const failCount = recentRuns.filter((r) => r.status === RunStatus.FAILED).length;

    return NextResponse.json({
      totalJobs,
      totalJobsInserted,
      totalDuplicates,
      totalRejected,
      totalRetries,
      successCount,
      failCount,
      lastSuccessAt: lastSuccessRun?.completedAt ?? null,
      activeRun: activeRun
        ? { id: activeRun.id, status: activeRun.status, source: activeRun.source }
        : null,
      sourceHealth: activeRun ? "RUNNING" : lastSuccessRun ? "HEALTHY" : "UNKNOWN",
    });
  } catch (err) {
    console.error("[GET /api/stats]", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
