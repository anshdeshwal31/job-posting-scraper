import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Lazy Prisma client singleton (Prisma 7 + adapter-pg).
 *
 * We expose `prisma` as a Proxy so the real PrismaClient is only
 * instantiated on first property access (i.e., inside a request handler),
 * never at module-import time. This prevents Next.js build from throwing
 * when DATABASE_URL is absent from the CI/build environment.
 *
 * At runtime the Proxy is transparent — `prisma.job.findMany(...)` works
 * exactly as if `prisma` were a real PrismaClient.
 */

const globalForPrisma = global as unknown as {
  _prismaInstance: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

function getInstance(): PrismaClient {
  if (!globalForPrisma._prismaInstance) {
    globalForPrisma._prismaInstance = createPrismaClient();
  }
  return globalForPrisma._prismaInstance;
}

// Proxy defers instantiation to first property access (first real DB call)
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getInstance();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as Function).bind(client);
    }
    return value;
  },
});

