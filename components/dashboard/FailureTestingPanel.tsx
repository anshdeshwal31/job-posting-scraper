"use client";

import React, { useState, useCallback } from "react";
import type { SandboxScenario } from "@/src/ingestion/types";

interface ScenarioButton {
  id: string;
  label: string;
  scenario: SandboxScenario;
  description: string;
  btnClass: string;
  icon: string;
}

const SCENARIOS: ScenarioButton[] = [
  {
    id: "btn-test-rate-limit",
    label: "Test Rate Limit",
    scenario: "429",
    description: "Source returns 429. Engine retries with backoff (respects Retry-After header).",
    btnClass: "btn btn-warning btn-sm",
    icon: "🚦",
  },
  {
    id: "btn-test-server-error",
    label: "Test Server Error",
    scenario: "500",
    description: "Source returns 500. Engine retries up to 4 times then marks run FAILED.",
    btnClass: "btn btn-danger btn-sm",
    icon: "💥",
  },
  {
    id: "btn-test-timeout",
    label: "Test Timeout",
    scenario: "timeout",
    description: "Source takes 35s. Client times out at 10s. Engine retries, then FAILED.",
    btnClass: "btn btn-danger btn-sm",
    icon: "⏱",
  },
  {
    id: "btn-test-empty",
    label: "Test Empty Response",
    scenario: "empty",
    description: "Source returns []. If DB has jobs, engine detects suspicious empty and skips upsert.",
    btnClass: "btn btn-warning btn-sm",
    icon: "📭",
  },
  {
    id: "btn-test-malformed",
    label: "Test Malformed Data",
    scenario: "malformed",
    description: "Source returns invalid shapes. Zod rejects all. 0 jobs stored, rejected count recorded.",
    btnClass: "btn btn-info btn-sm",
    icon: "🔀",
  },
];

interface FailureTestingPanelProps {
  onRunStarted?: (runId: string) => void;
}

export function FailureTestingPanel({ onRunStarted }: FailureTestingPanelProps) {
  const [activeScenario, setActiveScenario] = useState<SandboxScenario | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string; runId?: string }>>({});

  const handleTest = useCallback(
    async (scenario: SandboxScenario) => {
      setActiveScenario(scenario);
      try {
        const res = await fetch("/api/ingestion/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "sandbox", scenario }),
        });
        const data = await res.json();
        setResults((prev) => ({
          ...prev,
          [scenario]: {
            success: true,
            message: data.alreadyRunning
              ? `Existing run: ${data.runId}`
              : `Run queued: ${data.runId}`,
            runId: data.runId,
          },
        }));
        if (data.runId) {
          onRunStarted?.(data.runId);
        }
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [scenario]: { success: false, message: String(err) },
        }));
      } finally {
        setActiveScenario(null);
      }
    },
    [onRunStarted]
  );

  return (
    <div className="failure-panel">
      <div className="failure-panel-header">
        <span className="failure-panel-icon">🧪</span>
        <h2 className="failure-panel-title">Failure Testing</h2>
      </div>
      <p className="failure-panel-desc">
        Simulate source failures and observe how the ingestion pipeline responds.
        Each button triggers the <strong>same ingestion engine</strong> — no special paths.
        All resilience behavior (retry, backoff, empty guard) lives in the engine.
      </p>

      <div className="failure-buttons">
        {SCENARIOS.map((s) => (
          <button
            key={s.scenario}
            id={s.id}
            className={s.btnClass}
            onClick={() => handleTest(s.scenario)}
            disabled={activeScenario !== null}
            title={s.description}
            aria-label={`Test ${s.label} scenario`}
          >
            {activeScenario === s.scenario ? (
              <>
                <span className="spinner" style={{ borderTopColor: "currentColor" }} />
                Testing…
              </>
            ) : (
              <>
                <span>{s.icon}</span>
                {s.label}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Inline results */}
      {Object.entries(results).length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {SCENARIOS.filter((s) => results[s.scenario]).map((s) => {
            const r = results[s.scenario];
            return (
              <div
                key={s.scenario}
                className={`alert-banner ${r.success ? "alert-info" : "alert-error"}`}
                style={{ padding: "8px 12px", marginBottom: 0 }}
              >
                <span>{s.icon}</span>
                <div>
                  <strong>{s.label}:</strong>{" "}
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{r.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        {SCENARIOS.map((s) => (
          <div
            key={s.scenario}
            style={{
              display: "flex",
              gap: "8px",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "4px",
              alignItems: "flex-start",
            }}
          >
            <span style={{ flexShrink: 0 }}>{s.icon}</span>
            <span>
              <strong style={{ color: "var(--text-secondary)" }}>{s.label}:</strong>{" "}
              {s.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
