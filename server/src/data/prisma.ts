import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Wasmer Edge injects DB_HOST, DB_PORT, DB_NAME, DB_USERNAME and DB_PASSWORD
// and does not provide DATABASE_URL, so build one when it is missing.
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const user = encodeURIComponent(process.env.DB_USERNAME ?? "");
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? "");
  const port = process.env.DB_PORT ?? "5432";
  // Wasmer's Postgres uses a private CA, so TLS stays on without chain verification.
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${process.env.DB_HOST}:${port}/${process.env.DB_NAME}?sslmode=no-verify`;
}

process.env.DATABASE_URL ??= "postgresql://readingroom:readingroom@localhost:5432/readingroom";

export const prisma = new PrismaClient();
