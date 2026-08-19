"use client";

import React, { useState } from "react";
import type { Job } from "@prisma/client";

interface JobsTableProps {
  jobs: Job[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function JobsTable({ jobs, total, page, pages, onPageChange }: JobsTableProps) {
  if (!jobs.length) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="empty-icon">💼</span>
          <span className="empty-title">No jobs ingested yet</span>
          <span className="empty-desc">Run ingestion to populate the jobs database.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="text-sm text-muted">{total.toLocaleString()} total jobs</span>
        <span className="text-sm text-muted">Page {page} of {pages}</span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Company</th>
              <th>Location</th>
              <th>Source</th>
              <th>Posted</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <span title={job.title}>{truncate(job.title, 60)}</span>
                </td>
                <td>{truncate(job.company, 40)}</td>
                <td className="text-muted">{truncate(job.location, 30)}</td>
                <td>
                  <span className="pill">{job.source}</span>
                </td>
                <td className="text-muted td-mono">{formatDate(job.postedAt)}</td>
                <td>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            );
          })}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
