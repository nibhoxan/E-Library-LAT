import { Router } from "express";
import { prisma } from "../data/prisma.js";
import { requireDesk } from "./auth.js";

export const deskRouter = Router();
deskRouter.use(requireDesk);

deskRouter.get("/summary", async (_req, res, next) => {
  try {
    const [books, accounts, downloads, recent] = await Promise.all([
      prisma.title.count(),
      prisma.reader.count(),
      prisma.download.count(),
      prisma.download.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: { title: { select: { id: true, title: true, author: true } }, reader: { select: { email: true } } }
      })
    ]);
    return res.json({ books, accounts, downloads, recent });
  } catch (error) {
    return next(error);
  }
});

deskRouter.post("/titles", async (req, res, next) => {
  try {
    const { title, author, category, summary, publishedYear, gutenbergId } = req.body ?? {};
    if (![title, author, category, summary].every((value) => typeof value === "string" && value.trim())) {
      return res.status(400).json({ error: "Title, author, category, and summary are required." });
    }
    const created = await prisma.title.create({
      data: {
        title: title.trim(), author: author.trim(), category: category.trim(), summary: summary.trim(),
        ...(Number.isInteger(publishedYear) ? { publishedYear } : {}),
        ...(Number.isInteger(gutenbergId) && gutenbergId > 0 ? { gutenbergId } : {})
      }
    });
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

deskRouter.put("/titles/:id", async (req, res, next) => {
  try {
    const existing = await prisma.title.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Title not found." });
    const { title, author, category, summary, publishedYear, gutenbergId } = req.body ?? {};
    if (![title, author, category, summary].every((value) => typeof value === "string" && value.trim())) {
      return res.status(400).json({ error: "Title, author, category, and summary are required." });
    }
    const updated = await prisma.title.update({
      where: { id: req.params.id },
      data: {
        title: title.trim(), author: author.trim(), category: category.trim(), summary: summary.trim(),
        publishedYear: Number.isInteger(publishedYear) ? publishedYear : null,
        gutenbergId: Number.isInteger(gutenbergId) && gutenbergId > 0 ? gutenbergId : null
      }
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

deskRouter.delete("/titles/:id", async (req, res, next) => {
  try {
    await prisma.title.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
