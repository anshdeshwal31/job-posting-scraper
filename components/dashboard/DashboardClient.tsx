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

  // Auto-refresh every 5s when there's an active run, else every 30s
  useEffect(() => {
    const hasActiveRun = stats?.activeRun != null;
    const intervalMs = hasActiveRun ? 5_000 : 30_000;
    const id = setInterval(() => fetchAll(), intervalMs);
    return () => clearInterval(id);
  }, [stats?.activeRun, fetchAll]);

  const handleRunStarted = useCallback(() => {
    // Immediately poll for updates
    setTimeout(() => fetchAll(), 1500);
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
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">Job Ingestion</span>
            <span className="logo-badge">Acdyon Assessment</span>
          </div>
          <div className="header-right">
            <span className="text-xs text-muted">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fetchAll()}
              aria-label="Refresh dashboard"
            >
              ↺ Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Engineering Dashboard</h1>
            <p className="page-desc">
              Real-time visibility into the job ingestion pipeline — health, runs, failures, and stored jobs.
            </p>
          </div>
          <ManualIngestionButton onRunStarted={handleRunStarted} />
        </div>

        {/* ── Overview ────────────────────────────────────────────────── */}
        {stats && (
          <>
            <div className="section-header">
              <span className="section-title">System Overview</span>
            </div>
            <OverviewPanel stats={stats} />
          </>
        )}

        <div className="section-divider" />

        {/* ── Recent Runs ─────────────────────────────────────────────── */}
        <div className="section-header">
          <span className="section-title">Recent Ingestion Runs</span>
          <span className="section-subtitle">Last 10 runs</span>
        </div>
        <RunsTable runs={runs} />

        <div className="section-divider" />

        {/* ── Jobs ────────────────────────────────────────────────────── */}
        <div className="section-header">
          <span className="section-title">Ingested Jobs</span>
          {jobsData && (
            <span className="section-subtitle">
              {jobsData.pagination.total.toLocaleString()} total
            </span>
          )}
        </div>
        {jobsData ? (
          <JobsTable
            jobs={jobsData.jobs}
            total={jobsData.pagination.total}
            page={jobsData.pagination.page}
            pages={jobsData.pagination.pages}
            onPageChange={handlePageChange}
          />
        ) : (
          <div className="card">
            <div className="empty-state">
              <span className="empty-icon">💼</span>
              <span className="empty-title">No jobs yet</span>
            </div>
          </div>
        )}

        <div className="section-divider" />

        {/* ── Failure Testing ─────────────────────────────────────────── */}
        <div className="section-header">
          <span className="section-title">Failure Testing</span>
          <span className="section-subtitle">Engineering demonstration controls</span>
        </div>
        <FailureTestingPanel onRunStarted={handleRunStarted} />
      </main>
    </>
  );
}
