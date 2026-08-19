import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { inngest } from "@/src/inngest/client";
import { RunStatus } from "@prisma/client";
import type { IngestionOptions, SourceType, SandboxScenario } from "@/src/ingestion/types";

/**
 * POST /api/ingestion/run
 *
 * Triggers a new ingestion run.
 *
 * Body: { source: "remoteok" | "sandbox", scenario?: SandboxScenario }
 *
 * Concurrent ingestion guard:
 * Before creating a new run, we check if one is already RUNNING for this source.
 * If yes, we return the existing run rather than creating a new one.
 * This prevents duplicate concurrent fetches and race conditions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const source: SourceType = body.source ?? "remoteok";
    const scenario: SandboxScenario | undefined = body.scenario;

    // ── Concurrent ingestion guard ──────────────────────────────────────────
    const existingRun = await prisma.ingestionRun.findFirst({
      where: {
        source: source === "sandbox" ? `sandbox-${scenario ?? "normal"}` : source,
        status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
      },
      orderBy: { startedAt: "desc" },
    });

    if (existingRun) {
      return NextResponse.json(
        {
          message: "An ingestion is already running.",
          runId: existingRun.id,
          status: existingRun.status,
          alreadyRunning: true,
        },
        { status: 200 }
      );
    }

    // ── Create new QUEUED run ────────────────────────────────────────────────
    const sourceName =
      source === "sandbox" ? `sandbox-${scenario ?? "normal"}` : source;

    const run = await prisma.ingestionRun.create({
      data: {
        source: sourceName,
        scenario: source === "sandbox" ? (scenario ?? "normal") : null,
        status: RunStatus.QUEUED,
      },
    });

    // ── Fire Inngest event ───────────────────────────────────────────────────
    const options: IngestionOptions = {
      source,
      scenario,
      runId: run.id,
    };

    await inngest.send({
      name: "ingest/jobs.run",
      data: options,
    });

    return NextResponse.json(
      {
        message: "Ingestion queued.",
        runId: run.id,
        status: run.status,
        alreadyRunning: false,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("[POST /api/ingestion/run]", err);
    return NextResponse.json(
      { error: "Failed to trigger ingestion", details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingestion/run?runId=xxx
 * Returns the current status of a specific run, or the latest run if no ID.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");

    if (runId) {
      const run = await prisma.ingestionRun.findUnique({
        where: { id: runId },
        include: { events: { orderBy: { createdAt: "asc" } } },
      });
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      return NextResponse.json(run);
    }

    // Return the latest run
    const latestRun = await prisma.ingestionRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { events: { orderBy: { createdAt: "asc" }, take: 20 } },
    });
    return NextResponse.json(latestRun ?? null);
  } catch (err) {
    console.error("[GET /api/ingestion/run]", err);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
