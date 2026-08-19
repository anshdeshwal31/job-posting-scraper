import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";

/**
 * GET /api/runs?limit=10
 * Returns recent ingestion runs with their events.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

    const runs = await prisma.ingestionRun.findMany({
      take: limit,
      orderBy: { startedAt: "desc" },
      include: {
        events: {
          orderBy: { createdAt: "asc" },
          take: 20,
        },
      },
    });

    return NextResponse.json(runs);
  } catch (err) {
    console.error("[GET /api/runs]", err);
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}
