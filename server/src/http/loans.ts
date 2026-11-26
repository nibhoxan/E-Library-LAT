import { Router } from "express";
import PDFDocument from "pdfkit";
import type { Request } from "express";
import { prisma } from "../data/prisma.js";
import { optionalAuth } from "./auth.js";

export const loansRouter = Router();
const limits = { guest: 5, reader: 10 } as const;

function clientIp(req: Request) {
  return (req.ip || req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

loansRouter.get("/:titleId/card.pdf", optionalAuth, async (req, res, next) => {
  try {
    const title = await prisma.title.findUnique({ where: { id: req.params.titleId } });
    if (!title) return res.status(404).json({ error: "Title not found." });
    const user = req.user;
    const guestIp = user?.role === "reader" || user?.role === "desk" ? null : clientIp(req);
    const usedIds = user?.role === "reader" && user.sub
      ? await prisma.download.findMany({ where: { readerId: user.sub }, distinct: ["titleId"], select: { titleId: true } })
      : await prisma.download.findMany({ where: { guestIp }, distinct: ["titleId"], select: { titleId: true } });
    const alreadyCounted = usedIds.some((entry) => entry.titleId === title.id);
    const limit = user?.role === "reader" ? limits.reader : limits.guest;
    if (!alreadyCounted && usedIds.length >= limit) {
      return res.status(429).json({ error: `Your ${user?.role === "reader" ? "reader" : "guest"} allowance is ${limit} distinct titles.` });
    }
    await prisma.download.create({
      data: {
        titleId: title.id,
        ...(user?.role === "reader" && user.sub ? { readerId: user.sub } : {}),
        ...(guestIp ? { guestIp } : {})
      }
    });
    const document = new PDFDocument({ size: "A5", margin: 48, info: { Title: `${title.title} — Reading Room card`, Author: "Reading Room" } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => {
      const fileName = `${title.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-card.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(Buffer.concat(chunks));
    });
    document.font("Times-Roman").fontSize(10).fillColor("#52745c").text("READING ROOM · BIBLIOGRAPHIC CARD", { characterSpacing: 1.1 });
    document.moveDown(2).fontSize(24).fillColor("#1f3027").text(title.title, { lineGap: 4 });
    document.moveDown(0.7).fontSize(14).fillColor("#42644b").text(title.author);
    document.moveDown(1.8).fontSize(10).fillColor("#4f5b52");
    document.text(`Category  ${title.category}`);
    if (title.publishedYear) document.text(`First published  ${title.publishedYear}`);
    document.moveDown(1);
    document.text(title.summary, { lineGap: 4 });
    if (title.gutenbergId) {
      document.moveDown(1);
      document.fillColor("#42644b").text(`Read the public-domain text at Project Gutenberg: https://www.gutenberg.org/ebooks/${title.gutenbergId}`);
    }
    document.moveDown(2).fontSize(9).fillColor("#798078").text("This card contains bibliographic information only; it is not the book text.");
    document.end();
    return undefined;
  } catch (error) {
    return next(error);
  }
});
