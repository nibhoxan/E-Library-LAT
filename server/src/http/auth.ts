import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type UserClaims = {
  sub?: string;
  email?: string;
  name?: string;
  role: "guest" | "reader" | "desk";
};

const secret = () => {
  const value = process.env.JWT_SECRET ?? "local-reading-room-secret-change-me";
  if (process.env.NODE_ENV === "production" && value === "local-reading-room-secret-change-me") {
    throw new Error("JWT_SECRET must be set in production.");
  }
  return value;
};

export function issueToken(claims: UserClaims): string {
  return jwt.sign(claims, secret(), { expiresIn: "14d" });
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return next();
  try {
    req.user = jwt.verify(authorization.slice(7), secret()) as UserClaims;
    return next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

export function requireReader(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "reader" || !req.user.sub) {
    return res.status(401).json({ error: "Sign in with a reader account to use this feature." });
  }
  return next();
}

export function requireDesk(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "desk") {
    return res.status(403).json({ error: "Desk access is required." });
  }
  return next();
}
