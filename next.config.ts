import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma client must be treated as a server-only external package
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Expose public env vars
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
  },
};

export default nextConfig;
