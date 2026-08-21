"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OverviewPanel } from "@/components/dashboard/OverviewPanel";
import { RunsTable } from "@/components/dashboard/RunsTable";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { ManualIngestionButton } from "@/components/dashboard/ManualIngestionButton";
import { FailureTestingPanel } from "@/components/dashboard/FailureTestingPanel";
import type { IngestionRun, IngestionEvent, Job } from "@prisma/client";
import type { RunStatus } from "@prisma/client";

type RunWithEvents = IngestionRun & { events: IngestionEvent[] };

interface Stats {
  totalJobs: number;
  totalJobsInserted: number;
  totalDuplicates: number;
  totalRejected: number;
  totalRetries: number;
  successCount: number;
  failCount: number;
  lastSuccessAt: string | null;
  activeRun: { id: string; status: RunStatus; source: string } | null;
  sourceHealth: "HEALTHY" | "RUNNING" | "UNKNOWN" | "ERROR";
}

interface JobsData {
  jobs: Job[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<RunWithEvents[]>([]);
  const [jobsData, setJobsData] = useState<JobsData | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async (page = jobsPage) => {
    try {
      const [statsRes, runsRes, jobsRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/runs?limit=10"),
        fetch(`/api/jobs?page=${page}&limit=20`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
      if (jobsRes.ok) setJobsData(await jobsRes.json());
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [jobsPage]);

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 1s when there's an active run, else every 30s
  useEffect(() => {
    const hasActiveRun = stats?.activeRun != null;
    const intervalMs = hasActiveRun ? 1_000 : 30_000;
    const id = setInterval(() => fetchAll(), intervalMs);
    return () => clearInterval(id);
  }, [stats?.activeRun, fetchAll]);

  const handleRunStarted = useCallback(() => {
    // Immediately poll for updates
    fetchAll();
  }, [fetchAll]);

  const handlePageChange = useCallback((page: number) => {
    setJobsPage(page);
    fetchAll(page);
  }, [fetchAll]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 12px", borderWidth: 3 }} />
          <div>Loading dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="split-layout">
      {/* ── Left Column (Controls & Context) ──────────────────────── */}
      <div className="split-left">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <h1 className="page-title" style={{ fontSize: "24px", letterSpacing: "-0.04em", margin: 0 }}>
            RESILIENT INGESTION ENGINE
          </h1>
          <span className="pill badge-success" style={{ fontSize: "10px", padding: "2px 8px" }}>
            <span className="health-dot health-healthy" style={{ width: 6, height: 6, display: "inline-block" }} />
            Neon DB: Connected
          </span>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "40px" }}>
          A production-grade pull-based ingestion pipeline featuring automated backoff resilience,
          schema validation, and exact-match deduplication. Engineered to handle chaotic remote sources 
          without dropping valid data.
        </p>

        <div style={{ marginBottom: "48px" }}>
          <ManualIngestionButton onRunStarted={handleRunStarted} />
        </div>

        <FailureTestingPanel onRunStarted={handleRunStarted} />

        {stats && <OverviewPanel stats={stats} />}
      </div>

      {/* ── Right Column (Live Telemetry & Jobs) ────────────────────── */}
      <div className="split-right">
        <div className="split-right-scrollable">
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
              Live Telemetry Feed
            </span>
            <span className="text-xs text-muted">
              Auto-refreshing {stats?.activeRun ? "(1s)" : "(30s)"} · Last: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>

          <RunsTable runs={runs} />

          <div style={{ marginTop: "40px" }}>
            <details className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border)" }} open>
              <summary className="collapsible-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Ingested Normalized Jobs</span>
                  {jobsData && <span className="pill">{jobsData.pagination.total.toLocaleString()} records</span>}
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Toggle View</span>
              </summary>
              <div className="collapsible-content" style={{ padding: "0 20px 20px" }}>
                {jobsData ? (
                  <JobsTable
                    jobs={jobsData.jobs}
                    total={jobsData.pagination.total}
                    page={jobsData.pagination.page}
                    pages={jobsData.pagination.pages}
                    onPageChange={handlePageChange}
                  />
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">💼</span>
                    <span className="empty-title">No jobs yet</span>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
