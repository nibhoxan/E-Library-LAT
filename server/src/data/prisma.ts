import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { PoolConfig } from "pg";

/**
 * Connection settings for Postgres.
 * - Wasmer Edge injects DB_HOST, DB_PORT, DB_NAME, DB_USERNAME and DB_PASSWORD (no DATABASE_URL).
 *   Its Postgres certificate comes from a private CA, so TLS stays on without chain verification.
 * - Everywhere else DATABASE_URL is used.
 */
export function poolConfig(): PoolConfig {
  if (!process.env.DATABASE_URL && process.env.DB_HOST) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    };
  }
  return {
    connectionString: process.env.DATABASE_URL ?? "postgresql://readingroom:readingroom@localhost:5432/readingroom"
  };
}

// Prisma runs without its native query engine (engineType = "client"); the pg driver does the I/O.
export const prisma = new PrismaClient({ adapter: new PrismaPg(poolConfig()) });
