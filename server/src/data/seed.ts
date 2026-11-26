import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";
import { bookList } from "./catalog.js";

export async function seedDatabase() {
  const accounts = [
    { email: "reader@readingroom.local", name: "Reading Room Reader", password: "Reader123!", role: "reader" },
    { email: "desk@readingroom.local", name: "Reading Room Desk", password: "Desk123!", role: "desk" }
  ];
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.reader.upsert({
      where: { email: account.email },
      create: { email: account.email, name: account.name, role: account.role, passwordHash },
      update: { role: account.role }
    });
  }

  const count = await prisma.title.count();
  if (count >= 200) return;

  const existing = await prisma.title.findMany({ select: { title: true, author: true, gutenbergId: true } });
  const names = new Set(existing.map((item) => `${item.author.toLowerCase()}|${item.title.toLowerCase()}`));
  const gutenbergIds = new Set(existing.flatMap((item) => item.gutenbergId === null ? [] : [item.gutenbergId]));
  let inserted = 0;
  for (const work of bookList) {
    const key = `${work.author.toLowerCase()}|${work.title.toLowerCase()}`;
    if (names.has(key) || (work.gutenbergId !== undefined && gutenbergIds.has(work.gutenbergId))) continue;
    await prisma.title.create({ data: work });
    names.add(key);
    if (work.gutenbergId !== undefined) gutenbergIds.add(work.gutenbergId);
    inserted += 1;
    if (count + inserted >= 200) break;
  }
  if (count + inserted < 200) {
    throw new Error(`The built-in catalog contains only ${count + inserted} unique titles; at least 200 are required.`);
  }
}
