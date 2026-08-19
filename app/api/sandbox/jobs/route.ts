import { NextResponse } from "next/server";

const SANDBOX_JOBS = [
  {
    externalId: "sandbox-job-001",
    title: "Senior Backend Engineer",
    company: "Acme Corp",
    location: "Remote",
    description: "Build scalable distributed systems using Go and Kubernetes.",
    url: "https://example.com/jobs/senior-backend-engineer",
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    externalId: "sandbox-job-002",
    title: "Frontend Engineer (React)",
    company: "Globex Solutions",
    location: "Remote - US only",
    description: "Join our product team to build fast, beautiful UIs.",
    url: "https://example.com/jobs/frontend-react",
    postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    externalId: "sandbox-job-003",
    title: "DevOps / Platform Engineer",
    company: "Initech Systems",
    location: "Remote - Europe",
    description: "Own CI/CD pipelines, observability, and infra-as-code.",
    url: "https://example.com/jobs/devops-platform",
    postedAt: new Date().toISOString(),
  },
];

/**
 * GET /api/sandbox/jobs
 * Returns a valid set of sandbox job fixtures.
 * Used by the SandboxSource with scenario "normal".
 */
export async function GET() {
  return NextResponse.json(SANDBOX_JOBS);
}
