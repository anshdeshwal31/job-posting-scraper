"use client";

import React from "react";
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

export function OverviewPanel({ stats }: OverviewPanelProps) {
  return (
    <div className="bottom-metrics-bar">
      <div className="bottom-metric">
        <span className="bottom-metric-label">Total Ingested</span>
        <span className="bottom-metric-value">{stats.totalJobs.toLocaleString()}</span>
      </div>
      <div className="bottom-metric">
        <span className="bottom-metric-label">Duplicates Skipped</span>
        <span className="bottom-metric-value">{stats.totalDuplicates.toLocaleString()}</span>
      </div>
      <div className="bottom-metric">
        <span className="bottom-metric-label">Active Key</span>
        <span className="bottom-metric-value text-mono text-sm" style={{ fontWeight: 500 }}>
          {stats.activeRun ? stats.activeRun.source : "IDLE"}
        </span>
      </div>
      <div className="bottom-metric">
        <span className="bottom-metric-label">Last Run Status</span>
        <span className="bottom-metric-value" style={{ 
          fontSize: "14px", 
          color: stats.failCount > 0 ? "var(--status-failed)" : "var(--status-success)" 
        }}>
          {stats.activeRun ? "RUNNING" : (stats.failCount > 0 && stats.successCount === 0) ? "FAILED" : "SUCCESS"}
        </span>
      </div>
    </div>
  );
}

