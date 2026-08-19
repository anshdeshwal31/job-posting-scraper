"use client";

import React from "react";
import { RunStatusBadge } from "@/components/ui/RunStatusBadge";
import type { IngestionRun, IngestionEvent } from "@prisma/client";

type RunWithEvents = IngestionRun & { events: IngestionEvent[] };

interface RunsTableProps {
  runs: RunWithEvents[];
}

function formatDuration(start: Date | string, end: Date | string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const EVENT_ICONS: Record<string, string> = {
  INFO: "ℹ",
  RETRY: "↺",
  WARNING: "⚠",
  ERROR: "✕",
};

const EVENT_CLASSES: Record<string, string> = {
  INFO: "event-info",
  RETRY: "event-retry",
  WARNING: "event-warning",
  ERROR: "event-error",
};

export function RunsTable({ runs }: RunsTableProps) {
  if (!runs.length) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <span className="empty-title">No ingestion runs yet</span>
          <span className="empty-desc">Click "Run Ingestion" to start your first run.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {runs.map((run, idx) => (
        <div key={run.id} className="run-card">
          <div className="run-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Run #{runs.length - idx}
              </span>
              <RunStatusBadge status={run.status} />
              <span className="pill" style={{ fontSize: "11px" }}>
                {run.source}
              </span>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span className="text-xs text-muted">{formatTime(run.startedAt)}</span>
              <span className="text-xs text-muted" title="Duration">
                ⏱ {formatDuration(run.startedAt, run.completedAt)}
              </span>
            </div>
          </div>

          <div className="run-stats">
            <div className="run-stat">
              <span className="run-stat-label">Fetched</span>
              <span className="run-stat-value">{run.jobsFetched}</span>
            </div>
            <div className="run-stat">
              <span className="run-stat-label">New</span>
              <span className="run-stat-value" style={{ color: "var(--status-success)" }}>
                {run.jobsInserted}
              </span>
            </div>
            <div className="run-stat">
              <span className="run-stat-label">Dupes</span>
              <span className="run-stat-value" style={{ color: "var(--text-muted)" }}>
                {run.duplicates}
              </span>
            </div>
            <div className="run-stat">
              <span className="run-stat-label">Rejected</span>
              <span
                className="run-stat-value"
                style={{ color: run.rejected > 0 ? "var(--status-recovered)" : "var(--text-muted)" }}
              >
                {run.rejected}
              </span>
            </div>
            <div className="run-stat">
              <span className="run-stat-label">Retries</span>
              <span
                className="run-stat-value"
                style={{ color: run.retries > 0 ? "var(--status-recovered)" : "var(--text-muted)" }}
              >
                {run.retries}
              </span>
            </div>
          </div>

          {run.errorMessage && (
            <div className="alert-banner alert-error" style={{ marginBottom: 0, fontSize: "12px" }}>
              <span>✕</span>
              <span className="text-mono">{run.errorMessage}</span>
            </div>
          )}

          {run.events.length > 0 && (
            <div className="run-events">
              {run.events.slice(0, 5).map((ev) => (
                <div key={ev.id} className={`run-event event-${ev.type.toLowerCase()}`}>
                  <span className={`event-icon ${EVENT_CLASSES[ev.type] ?? ""}`}>
                    {EVENT_ICONS[ev.type] ?? "·"}
                  </span>
                  <span>{ev.message}</span>
                </div>
              ))}
              {run.events.length > 5 && (
                <span className="text-xs text-muted" style={{ marginLeft: "18px" }}>
                  +{run.events.length - 5} more events
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
