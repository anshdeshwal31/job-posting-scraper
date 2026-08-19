"use client";

import React from "react";
import { MetricCard } from "@/components/ui/MetricCard";
import { RunStatusBadge } from "@/components/ui/RunStatusBadge";
import type { RunStatus } from "@prisma/client";

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

interface OverviewPanelProps {
  stats: Stats;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 60000) return "Just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

const HEALTH_CONFIG = {
  HEALTHY: { cls: "health-healthy", label: "Healthy", color: "var(--status-success)" },
  RUNNING: { cls: "health-running", label: "Running", color: "var(--status-running)" },
  UNKNOWN: { cls: "health-unknown", label: "Unknown", color: "var(--text-muted)" },
  ERROR:   { cls: "health-error",   label: "Error",   color: "var(--status-failed)" },
};

export function OverviewPanel({ stats }: OverviewPanelProps) {
  const health = HEALTH_CONFIG[stats.sourceHealth] ?? HEALTH_CONFIG.UNKNOWN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Source Health Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div className="health-indicator">
          <span className={`health-dot ${health.cls}`} />
          <span style={{ color: health.color }}>{health.label}</span>
          <span className="text-muted text-sm">— RemoteOK Source</span>
        </div>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Last Success</div>
            <div style={{ fontSize: "13px", fontWeight: 500 }}>
              {formatRelativeTime(stats.lastSuccessAt)}
            </div>
          </div>
          {stats.activeRun && (
            <div>
              <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Active Run</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <RunStatusBadge status={stats.activeRun.status} />
                <span className="text-xs text-muted text-mono">{stats.activeRun.id.slice(0, 8)}…</span>
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Run History</div>
            <div style={{ fontSize: "13px", fontWeight: 500 }}>
              <span style={{ color: "var(--status-success)" }}>{stats.successCount} ok</span>
              {" · "}
              <span style={{ color: "var(--status-failed)" }}>{stats.failCount} failed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid-4">
        <MetricCard
          label="Total Jobs"
          value={stats.totalJobs.toLocaleString()}
          sub="in database"
          color="var(--accent-blue)"
        />
        <MetricCard
          label="Jobs Inserted"
          value={stats.totalJobsInserted.toLocaleString()}
          sub="across all runs"
          color="var(--status-success)"
        />
        <MetricCard
          label="Duplicates"
          value={stats.totalDuplicates.toLocaleString()}
          sub="correctly skipped"
          color="var(--text-muted)"
        />
        <MetricCard
          label="Rejected"
          value={stats.totalRejected.toLocaleString()}
          sub="failed Zod validation"
          color={stats.totalRejected > 0 ? "var(--status-recovered)" : "var(--text-muted)"}
        />
      </div>

      {stats.totalRetries > 0 && (
        <div className="alert-banner alert-warning" style={{ marginBottom: 0 }}>
          <span>↺</span>
          <span>
            <strong>{stats.totalRetries}</strong> retries recorded across recent runs — resilience layer is working.
          </span>
        </div>
      )}
    </div>
  );
}
