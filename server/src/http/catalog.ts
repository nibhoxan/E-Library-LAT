import { Router } from "express";
import { prisma } from "../data/prisma.js";

export const catalogRouter = Router();

catalogRouter.get("/", async (req, res, next) => {
  try {
    const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
    const author = typeof req.query.author === "string" ? req.query.author.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filters = [
      title ? { title: { contains: title, mode: "insensitive" as const } } : undefined,
      author ? { author: { contains: author, mode: "insensitive" as const } } : undefined,
      category ? { category: { contains: category, mode: "insensitive" as const } } : undefined,
      query ? { OR: [{ title: { contains: query, mode: "insensitive" as const } }, { author: { contains: query, mode: "insensitive" as const } }, { category: { contains: query, mode: "insensitive" as const } }] } : undefined
    ].filter(Boolean);
    const where = filters.length ? { AND: filters as Array<Record<string, unknown>> } : {};
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(60, Math.max(1, Number.parseInt(String(req.query.limit ?? "24"), 10) || 24));
    const [items, total] = await Promise.all([
      prisma.title.findMany({ where, orderBy: [{ title: "asc" }, { author: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.title.count({ where })
    ]);
    return res.json({ items, total, page, pageSize });
  } catch (error) {
    return next(error);
  }
});

catalogRouter.get("/:id", async (req, res, next) => {
  try {
    const title = await prisma.title.findUnique({ where: { id: req.params.id } });
    if (!title) return res.status(404).json({ error: "Title not found." });
    return res.json(title);
  } catch (error) {
    return next(error);
  }
});
