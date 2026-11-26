import "dotenv/config";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { prisma } from "./data/prisma.js";
import { seedDatabase } from "./data/seed.js";
import { sessionRouter } from "./http/session.js";
import { catalogRouter } from "./http/catalog.js";
import { loansRouter } from "./http/loans.js";
import { shelvesRouter } from "./http/shelves.js";
import { deskRouter } from "./http/desk.js";
import { librarianRouter } from "./http/librarian.js";
import { optionalAuth, validateJwtSecret } from "./http/auth.js";

const app = express();
const port = Number(process.env.PORT ?? 4100);
const executeFile = promisify(execFile);
const require = createRequire(import.meta.url);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDist = path.resolve(serverRoot, "../client/dist");
const clientIndex = path.join(clientDist, "index.html");

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(optionalAuth);
app.get("/api/health", (_req, res) => res.json({ status: "ready" }));
app.use("/api/session", sessionRouter);
app.use("/api/titles", catalogRouter);
app.use("/api/downloads", loansRouter);
app.use("/api/shelves", shelvesRouter);
app.use("/api/desk", deskRouter);
app.use("/api/librarian", librarianRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  if (!existsSync(clientIndex)) return res.status(404).end();
  return res.sendFile(clientIndex, (error) => {
    if (error) next(error);
  });
});
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  console.error(error);
  return res.status(500).json({ error: message });
});

async function prepareDatabase() {
  const prismaCli = require.resolve("prisma/build/index.js");
  await executeFile(process.execPath, [prismaCli, "db", "push", "--schema", path.resolve(serverRoot, "prisma/schema.prisma")], { cwd: serverRoot });
  await prisma.$connect();
  await seedDatabase();
  console.info(`Reading Room API is ready with ${await prisma.title.count()} titles.`);
}

async function start() {
  validateJwtSecret();
  await prepareDatabase();
  const server = app.listen(port, "0.0.0.0", () => {
    console.info(`Reading Room API listening on port ${port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
      });
    });
  }
}

void start().catch((error: unknown) => {
  console.error("API startup failed before listening:", error);
  process.exitCode = 1;
});
