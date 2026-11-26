import { Router } from "express";
import { answerLibrarian } from "../librarian/conversation.js";
import { librarianTools } from "../librarian/tools.js";

export const librarianRouter = Router();

librarianRouter.get("/tools", (_req, res) => res.json({ tools: librarianTools }));
librarianRouter.post("/", async (req, res, next) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 1000) {
      return res.status(400).json({ error: "Enter a message up to 1,000 characters." });
    }
    return res.json(await answerLibrarian(message));
  } catch (error) {
    return next(error);
  }
});
