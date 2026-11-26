import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { sessionRouter } from "./http/session.js";
import { catalogRouter } from "./http/catalog.js";
import { loansRouter } from "./http/loans.js";
import { shelvesRouter } from "./http/shelves.js";
import { deskRouter } from "./http/desk.js";
import { librarianRouter } from "./http/librarian.js";
import { optionalAuth } from "./http/auth.js";

const app = express();
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

export { app };
