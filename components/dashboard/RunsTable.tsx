"use client";

import React from "react";
import { RunStatus } from "@prisma/client";
import type { IngestionRun, IngestionEvent } from "@prisma/client";

type RunWithEvents = IngestionRun & { events: IngestionEvent[] };

interface RunsTableProps {
  runs: RunWithEvents[];
}

function formatTimeOnly(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

const EVENT_COLOR: Record<string, string> = {
  INFO: "#a9b1d6",
  RETRY: "var(--status-recovered)",
  WARNING: "var(--status-recovered)",
  ERROR: "var(--status-failed)",
};

export function RunsTable({ runs }: RunsTableProps) {
  if (!runs.length) {
    return (
      <div className="console-container">
        <div className="console-header">
          <div className="console-dots">
            <div className="console-dot" />
            <div className="console-dot" />
            <div className="console-dot" />
          </div>
          system terminal
        </div>
        <div className="console-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
          <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>Waiting for telemetry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="console-container">
      <div className="console-header">
        <div className="console-dots">
          <div className="console-dot" />
          <div className="console-dot" />
          <div className="console-dot" />
        </div>
        live telemetry / pipeline trace
      </div>
      <div className="console-body">
        {runs.map((run, idx) => {
          let statusPillClass = "pill ";
          let statusText = run.status.toString();
          
          if (run.status === RunStatus.SUCCESS) {
            statusPillClass += "badge-success";
            statusText = "200 SUCCESS";
          } else if (run.status === RunStatus.RECOVERED) {
            statusPillClass = "pill badge-recovered";
            statusText = "RECOVERED";
          } else if (run.status === RunStatus.FAILED) {
            statusPillClass += "badge-failed";
          } else if (run.status === RunStatus.QUEUED || run.status === RunStatus.RUNNING) {
            statusPillClass += "badge-running";
          }

          return (
            <div key={run.id} style={{ marginBottom: "24px", borderLeft: "2px solid #333", paddingLeft: "16px" }}>
              <div className="console-line">
                <span className="console-time">[{formatTimeOnly(run.startedAt)}]</span>
                <span className="console-content" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#7aa2f7", fontWeight: "bold" }}>➔ INGEST_TRIGGERED</span>
                  <span style={{ color: "#bb9af7" }}>source={run.source}</span>
                  <span style={{ color: "#565f89" }}>id={run.id.slice(0,8)}</span>
                  <span className={statusPillClass} style={{ marginLeft: "auto", fontSize: "10px", padding: "1px 6px" }}>{statusText}</span>
                </span>
              </div>
              
              {/* Event Trace */}
              {run.events.map((ev) => (
                <div key={ev.id} className="console-line">
                  <span className="console-time">[{formatTimeOnly(ev.createdAt)}]</span>
                  <span className="console-content" style={{ color: EVENT_COLOR[ev.type] || EVENT_COLOR.INFO }}>
                    {ev.message}
                  </span>
                </div>
              ))}

              {/* Summary line if completed or failed */}
              {(run.status === RunStatus.SUCCESS || run.status === RunStatus.RECOVERED || run.status === RunStatus.FAILED) && (
                <div className="console-line">
                  <span className="console-time">[{formatTimeOnly(run.completedAt || new Date())}]</span>
                  <span className="console-content" style={{ color: run.status === RunStatus.FAILED ? "#f7768e" : "#9ece6a" }}>
                    {run.status === RunStatus.FAILED ? "✘" : "✔"} RUN_{run.status} — 
                    fetched={run.jobsFetched} 
                    {" "}inserted={run.jobsInserted} 
                    {" "}rejected={run.rejected}
                    {" "}duplicates={run.duplicates}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
