"use client";

import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export function MetricCard({ label, value, sub, color = "var(--accent-blue)" }: MetricCardProps) {
  return (
    <div
      className="metric-card"
      style={{ ["--metric-color" as string]: color }}
    >
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
