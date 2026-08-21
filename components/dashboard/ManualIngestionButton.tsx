"use client";

import React, { useState, useCallback, useEffect } from "react";

interface TriggerResult {
  runId: string;
  status: string;
  alreadyRunning: boolean;
  message: string;
}

interface ManualIngestionButtonProps {
  onRunStarted?: (runId: string) => void;
}

export function ManualIngestionButton({ onRunStarted }: ManualIngestionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/ingestion/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "remoteok" }),
      });
      const data = await res.json();
      if (!res.ok && !data.runId) {
        throw new Error(data.error ?? "Unknown error");
      }
      setResult(data);
      if (data.runId) {
        onRunStarted?.(data.runId);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [onRunStarted]);

  // Auto-clear result after 8 seconds
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 8000);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <button
        id="btn-run-ingestion"
        className="btn btn-primary btn-lg"
        onClick={handleClick}
        disabled={loading}
        aria-label="Run ingestion manually"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Running…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 2v12M2 8l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Run Ingestion
          </>
        )}
      </button>

      {error && (
        <div className="alert-banner alert-error" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div
          className={`alert-banner ${result.alreadyRunning ? "alert-warning" : "alert-success"}`}
          role="status"
        >
          <span>{result.alreadyRunning ? "⏳" : "✓"}</span>
          <div>
            <div style={{ fontWeight: 600 }}>
              {result.alreadyRunning ? "An ingestion is already running. Tracking active run..." : result.message}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8, fontFamily: "monospace", marginTop: 2 }}>
              Run ID: {result.runId} · Status: {result.status}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
