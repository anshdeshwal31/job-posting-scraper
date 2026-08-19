"use client";

import React from "react";
import type { RunStatus } from "@prisma/client";

interface RunStatusBadgeProps {
  status: RunStatus;
}

const STATUS_MAP: Record<RunStatus, { label: string; cls: string }> = {
  QUEUED:    { label: "Queued",    cls: "badge badge-queued" },
  RUNNING:   { label: "Running",   cls: "badge badge-running" },
  SUCCESS:   { label: "Success",   cls: "badge badge-success" },
  RECOVERED: { label: "Recovered", cls: "badge badge-recovered" },
  FAILED:    { label: "Failed",    cls: "badge badge-failed" },
};

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const { label, cls } = STATUS_MAP[status] ?? STATUS_MAP.QUEUED;
  return (
    <span className={cls}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}
