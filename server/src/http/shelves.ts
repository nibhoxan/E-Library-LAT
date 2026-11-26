import { Router } from "express";
import { prisma } from "../data/prisma.js";
import { requireReader } from "./auth.js";

export const shelvesRouter = Router();
shelvesRouter.use(requireReader);

shelvesRouter.get("/", async (req, res, next) => {
  try {
    const [shelf, bookmarks] = await Promise.all([
      prisma.shelfEntry.findMany({ where: { readerId: req.user!.sub }, include: { title: true }, orderBy: { createdAt: "desc" } }),
      prisma.bookmark.findMany({ where: { readerId: req.user!.sub }, include: { title: true }, orderBy: { createdAt: "desc" } })
    ]);
    return res.json({ shelf: shelf.map((entry) => entry.title), bookmarks: bookmarks.map((entry) => entry.title) });
  } catch (error) {
    return next(error);
  }
});

shelvesRouter.post("/", async (req, res, next) => {
  try {
    const titleId = typeof req.body?.titleId === "string" ? req.body.titleId : "";
    if (!titleId) return res.status(400).json({ error: "A titleId is required." });
    const title = await prisma.title.findUnique({ where: { id: titleId } });
    if (!title) return res.status(404).json({ error: "Title not found." });
    await prisma.shelfEntry.upsert({
      where: { readerId_titleId: { readerId: req.user!.sub!, titleId } },
      create: { readerId: req.user!.sub!, titleId },
      update: {}
    });
    return res.status(201).json({ title });
  } catch (error) {
    return next(error);
  }
});

shelvesRouter.delete("/:titleId", async (req, res, next) => {
  try {
    await prisma.shelfEntry.deleteMany({ where: { readerId: req.user!.sub, titleId: req.params.titleId } });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

shelvesRouter.post("/bookmarks", async (req, res, next) => {
  try {
    const titleId = typeof req.body?.titleId === "string" ? req.body.titleId : "";
    if (!titleId) return res.status(400).json({ error: "A titleId is required." });
    const title = await prisma.title.findUnique({ where: { id: titleId } });
    if (!title) return res.status(404).json({ error: "Title not found." });
    await prisma.bookmark.upsert({
      where: { readerId_titleId: { readerId: req.user!.sub!, titleId } },
      create: { readerId: req.user!.sub!, titleId },
      update: {}
    });
    return res.status(201).json({ title });
  } catch (error) {
    return next(error);
  }
});

shelvesRouter.delete("/bookmarks/:titleId", async (req, res, next) => {
  try {
    await prisma.bookmark.deleteMany({ where: { readerId: req.user!.sub, titleId: req.params.titleId } });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
