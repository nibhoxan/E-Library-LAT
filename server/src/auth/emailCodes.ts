import { prisma } from "../data/prisma.js";
import { codeEmail, sendEmail } from "../email/brevo.js";
import {
  CODE_TTL_MINUTES, MAX_CODE_ATTEMPTS, RESEND_COOLDOWN_SECONDS,
  codeMatches, expiryFrom, generateCode, hashCode, type CodePurpose
} from "./codes.js";

type Recipient = { id: string; email: string; name: string };

/**
 * Creates a fresh code (replacing any unused one) and emails it. Returns "cooldown" when a code was sent less than
 * a minute ago, "failed" when Brevo could not deliver it, and "sent" otherwise.
 */
export async function sendCode(reader: Recipient, purpose: CodePurpose): Promise<"sent" | "cooldown" | "failed"> {
  const now = new Date();
  const latest = await prisma.emailCode.findFirst({
    where: { readerId: reader.id, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  if (latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) return "cooldown";

  const code = generateCode();
  await prisma.$transaction([
    prisma.emailCode.updateMany({ where: { readerId: reader.id, purpose, usedAt: null }, data: { usedAt: now } }),
    prisma.emailCode.create({
      data: { readerId: reader.id, purpose, codeHash: hashCode(reader.id, purpose, code), expiresAt: expiryFrom(now) }
    })
  ]);

  try {
    await sendEmail({ to: reader.email, ...codeEmail(purpose, reader.name, code, CODE_TTL_MINUTES) });
    return "sent";
  } catch {
    return "failed";
  }
}

/**
 * Checks a code the reader typed. Every check counts as an attempt (counted atomically before comparing), a code
 * allows MAX_CODE_ATTEMPTS tries, expires after CODE_TTL_MINUTES, and can be used once.
 */
export async function consumeCode(readerId: string, purpose: CodePurpose, code: string): Promise<boolean> {
  const now = new Date();
  const active = await prisma.emailCode.findFirst({
    where: { readerId, purpose, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" }
  });
  if (!active) return false;

  const counted = await prisma.emailCode.update({ where: { id: active.id }, data: { attempts: { increment: 1 } } });
  if (counted.attempts > MAX_CODE_ATTEMPTS) return false;
  if (!codeMatches(active.codeHash, readerId, purpose, code)) return false;

  // Only one request can flip usedAt from null, so a code cannot be spent twice by parallel requests.
  const spent = await prisma.emailCode.updateMany({ where: { id: active.id, usedAt: null }, data: { usedAt: now } });
  return spent.count === 1;
}
