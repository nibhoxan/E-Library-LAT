import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

/**
 * Small in-memory limiter. It resets when the server restarts and is per instance, which is enough to slow down
 * code guessing and email flooding. The per-code attempt counter in the database is the hard limit for guessing.
 */
export function createLimiter(options: { windowMs: number; max: number; key: (req: Request) => string | null; now?: () => number }) {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;

  function sweep(time: number) {
    if (buckets.size < 5000) return;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(key);
  }

  return function limit(req: Request, res: Response, next: NextFunction) {
    const key = options.key(req);
    if (!key) return next();
    const time = now();
    sweep(time);
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > time ? existing : { count: 0, resetAt: time + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - time) / 1000))));
      return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
    }
    return next();
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return (first || req.ip || req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

export function emailFromBody(req: Request): string | null {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return email ? email.slice(0, 254) : null;
}
