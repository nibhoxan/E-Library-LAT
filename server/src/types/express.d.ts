import type { UserClaims } from "../http/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: UserClaims;
    }
  }
}

export {};
