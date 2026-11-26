import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

export type CodePurpose = "verify" | "reset";

export function generateCode(): string {
  let value: number;
  try {
    value = randomInt(0, 10 ** CODE_LENGTH);
  } catch {
    // Fallback for runtimes without crypto.randomInt.
    value = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** CODE_LENGTH;
  }
  return value.toString().padStart(CODE_LENGTH, "0");
}

function secret() {
  return process.env.JWT_SECRET ?? "local-reading-room-secret-change-me";
}

/** Keyed hash, so a leaked database row alone does not reveal the code. Bound to the reader and purpose. */
export function hashCode(readerId: string, purpose: CodePurpose, code: string): string {
  return createHmac("sha256", secret()).update(`${readerId}:${purpose}:${code}`).digest("hex");
}

export function codeMatches(storedHash: string, readerId: string, purpose: CodePurpose, code: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(readerId, purpose, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/\s+/g, "");
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(cleaned) ? cleaned : null;
}

export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
}
