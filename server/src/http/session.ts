import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../data/prisma.js";
import { consumeCode, sendCode } from "../auth/emailCodes.js";
import { normalizeCode } from "../auth/codes.js";
import { clientIp, createLimiter, emailFromBody } from "../auth/rateLimit.js";
import { issueToken, optionalAuth } from "./auth.js";

export const sessionRouter = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invalidCode = { error: "That code is not valid or has expired. Request a new one and try again." };
const resetNotice = { message: "If an account exists for that email, a code is on its way." };
const verifyNotice = { message: "If that account still needs verification, a new code is on its way." };

// Slow down guessing and email flooding: per client address, and per email address.
const byAddress = createLimiter({ windowMs: 10 * 60_000, max: 60, key: (req) => `ip:${clientIp(req)}` });
const byEmail = createLimiter({ windowMs: 10 * 60_000, max: 12, key: (req) => {
  const email = emailFromBody(req);
  return email ? `email:${email}` : null;
} });

type ReaderRow = { id: string; email: string; name: string; role: string };
const publicReader = (reader: ReaderRow) => ({ id: reader.id, email: reader.email, name: reader.name, role: reader.role });
const sessionFor = (reader: ReaderRow) => ({
  token: issueToken({ sub: reader.id, email: reader.email, name: reader.name, role: reader.role as "reader" | "desk" }),
  reader: publicReader(reader)
});

sessionRouter.post("/guest", (_req, res) => {
  res.json({ token: issueToken({ role: "guest" }), role: "guest" });
});

sessionRouter.post("/register", byAddress, byEmail, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (name.length < 1 || name.length > 80 || !emailPattern.test(email) || password.length < 8) {
      return res.status(400).json({ error: "Enter a name, valid email, and password with at least 8 characters." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.reader.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    // An unverified sign-up has no data yet, so a repeat sign-up replaces it. Only the person who can read the
    // email can finish verification, which keeps the real owner from being locked out of their own address.
    const reader = existing
      ? await prisma.reader.update({ where: { email }, data: { name, passwordHash } })
      : await prisma.reader.create({ data: { name, email, passwordHash, role: "reader" } });
    const outcome = await sendCode(reader, "verify");
    return res.status(201).json({ verificationRequired: true, email: reader.email, emailSent: outcome !== "failed" });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    return next(error);
  }
});

sessionRouter.post("/verify-email", byAddress, byEmail, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const code = normalizeCode(req.body?.code);
    if (!emailPattern.test(email) || !code) return res.status(400).json(invalidCode);
    const reader = await prisma.reader.findUnique({ where: { email } });
    if (!reader || reader.emailVerifiedAt) return res.status(400).json(invalidCode);
    if (!(await consumeCode(reader.id, "verify", code))) return res.status(400).json(invalidCode);
    const verified = await prisma.reader.update({ where: { id: reader.id }, data: { emailVerifiedAt: new Date() } });
    return res.json(sessionFor(verified));
  } catch (error) {
    return next(error);
  }
});

sessionRouter.post("/resend-code", byAddress, byEmail, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const reader = emailPattern.test(email) ? await prisma.reader.findUnique({ where: { email } }) : null;
    // Same answer for unknown, verified, and unverified accounts, so the endpoint does not reveal which exist.
    if (reader && !reader.emailVerifiedAt) await sendCode(reader, "verify");
    return res.json(verifyNotice);
  } catch (error) {
    return next(error);
  }
});

sessionRouter.post("/login", byAddress, byEmail, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const reader = await prisma.reader.findUnique({ where: { email } });
    if (!reader || !(await bcrypt.compare(password, reader.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (!reader.emailVerifiedAt) {
      // The password was right, so it is safe to say the email still needs verifying. Send a code if none is active.
      await sendCode(reader, "verify");
      return res.status(403).json({
        error: "Verify your email first. We sent a 6-digit code to your inbox.",
        code: "EMAIL_NOT_VERIFIED",
        email: reader.email
      });
    }
    return res.json(sessionFor(reader));
  } catch (error) {
    return next(error);
  }
});

sessionRouter.post("/forgot-password", byAddress, byEmail, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const reader = emailPattern.test(email) ? await prisma.reader.findUnique({ where: { email } }) : null;
    // Always the same response, whether or not the account exists or the email could be sent.
    if (reader) await sendCode(reader, "reset");
    return res.json(resetNotice);
  } catch (error) {
    return next(error);
  }
});

sessionRouter.post("/reset-password", byAddress, byEmail, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const code = normalizeCode(req.body?.code);
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Choose a new password with at least 8 characters." });
    }
    if (!emailPattern.test(email) || !code) return res.status(400).json(invalidCode);
    const reader = await prisma.reader.findUnique({ where: { email } });
    if (!reader || !(await consumeCode(reader.id, "reset", code))) return res.status(400).json(invalidCode);
    await prisma.reader.update({
      where: { id: reader.id },
      // Receiving the reset code proves the person controls the inbox, so the account counts as verified too.
      data: { passwordHash: await bcrypt.hash(newPassword, 12), emailVerifiedAt: reader.emailVerifiedAt ?? new Date() }
    });
    return res.json({ message: "Your password was updated. You can sign in now." });
  } catch (error) {
    return next(error);
  }
});

sessionRouter.post("/logout", (_req, res) => res.json({ message: "Signed out." }));

sessionRouter.get("/me", optionalAuth, (req, res) => {
  if (!req.user?.sub || (req.user.role !== "reader" && req.user.role !== "desk")) {
    return res.status(401).json({ error: "Sign in to view your account." });
  }
  return res.json({ id: req.user.sub, email: req.user.email, name: req.user.name, role: req.user.role });
});
