import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acdyon Job Ingestion — Engineering Dashboard",
  description:
    "Production-minded job ingestion pipeline with resilience, deduplication, and observability. Built for the Acdyon Part 1 assessment.",
  keywords: ["job ingestion", "pipeline", "resilience", "engineering dashboard"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div className="page-wrapper">{children}</div>
      </body>
    </html>
  );
}
