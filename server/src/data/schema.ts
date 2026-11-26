import pg from "pg";
import { poolConfig } from "./prisma.js";

/**
 * Creates the tables when they do not exist yet. This replaces `prisma db push`, which needs
 * Prisma's native schema engine and cannot run on Wasmer Edge. Keep it in step with prisma/schema.prisma.
 * Every statement is idempotent, so it is safe to run on each start.
 */
const statements = [
  `CREATE TABLE IF NOT EXISTS "Reader" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'reader',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reader_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Title" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "publishedYear" INTEGER,
    "gutenbergId" INTEGER,
    "coverUrl" TEXT,
    "coverCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Download" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "readerId" TEXT,
    "guestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Download_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Download_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Download_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Bookmark_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ShelfEntry" (
    "id" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShelfEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShelfEntry_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShelfEntry_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "EmailCode" (
    "id" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmailCode_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "EmailCode_readerId_purpose_idx" ON "EmailCode"("readerId", "purpose")`,
  `ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT`,
  `ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "coverCheckedAt" TIMESTAMP(3)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Reader_email_key" ON "Reader"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Title_gutenbergId_key" ON "Title"("gutenbergId")`,
  `CREATE INDEX IF NOT EXISTS "Title_title_idx" ON "Title"("title")`,
  `CREATE INDEX IF NOT EXISTS "Title_author_idx" ON "Title"("author")`,
  `CREATE INDEX IF NOT EXISTS "Title_category_idx" ON "Title"("category")`,
  `CREATE INDEX IF NOT EXISTS "Download_readerId_titleId_idx" ON "Download"("readerId", "titleId")`,
  `CREATE INDEX IF NOT EXISTS "Download_guestIp_titleId_idx" ON "Download"("guestIp", "titleId")`,
  `CREATE INDEX IF NOT EXISTS "Download_createdAt_idx" ON "Download"("createdAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_readerId_titleId_key" ON "Bookmark"("readerId", "titleId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ShelfEntry_readerId_titleId_key" ON "ShelfEntry"("readerId", "titleId")`
];

export async function ensureSchema() {
  const client = new pg.Client(poolConfig());
  await client.connect();
  try {
    // Existing databases already have a Reader table without emailVerifiedAt. Add the column once and treat
    // every account that existed before email verification as verified, so nobody is locked out. The check
    // makes this run only the first time; accounts created later start unverified.
    const hadReaderTable = (await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Reader'`
    )).rowCount === 1;
    const hadVerifiedColumn = (await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Reader' AND column_name = 'emailVerifiedAt'`
    )).rowCount === 1;
    if (hadReaderTable && !hadVerifiedColumn) {
      await client.query("BEGIN");
      try {
        await client.query(`ALTER TABLE "Reader" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3)`);
        await client.query(`UPDATE "Reader" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL`);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    for (const statement of statements) await client.query(statement);
  } finally {
    await client.end();
  }
}
