import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../data/prisma.js";
import { issueToken, optionalAuth } from "./auth.js";

export const sessionRouter = Router();

sessionRouter.post("/guest", (_req, res) => {
  res.json({ token: issueToken({ role: "guest" }), role: "guest" });
});

sessionRouter.post("/register", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (name.length < 1 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return res.status(400).json({ error: "Enter a name, valid email, and password with at least 8 characters." });
    }
    const reader = await prisma.reader.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "reader" }
    });
    return res.status(201).json({
      token: issueToken({ sub: reader.id, email: reader.email, name: reader.name, role: "reader" }),
      reader: { id: reader.id, email: reader.email, name: reader.name, role: reader.role }
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    return next(error);
  }
});

sessionRouter.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const reader = await prisma.reader.findUnique({ where: { email } });
    if (!reader || !(await bcrypt.compare(password, reader.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    return res.json({
      token: issueToken({ sub: reader.id, email: reader.email, name: reader.name, role: reader.role as "reader" | "desk" }),
      reader: { id: reader.id, email: reader.email, name: reader.name, role: reader.role }
    });
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
