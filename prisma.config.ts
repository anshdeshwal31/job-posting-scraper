import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
import path from "path";

// Explicitly load .env.local then .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Prefer DIRECT_URL for CLI operations (schema push/migration) to bypass PgBouncer
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});


