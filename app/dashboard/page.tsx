import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata = {
  title: "Dashboard — Acdyon Job Ingestion",
  description: "Real-time engineering dashboard for the Acdyon job ingestion pipeline.",
};

/**
 * Dashboard page.
 * A thin server component that renders the client-side dashboard.
 * Business logic lives in DashboardClient and the API routes.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
