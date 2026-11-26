import { prisma } from "../data/prisma.js";

export const librarianTools = [
  {
    name: "find_titles",
    description: "Search the live catalog by title, author, or category.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  },
  {
    name: "read_record",
    description: "Read live bibliographic records for catalog title IDs.",
    parameters: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] }
  },
  {
    name: "save_to_shelf",
    description: "Prepare a shelf addition for the reader to confirm; this tool never writes to the shelf.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  }
] as const;

export async function findTitles(query: string) {
  const phrase = query.trim();
  if (!phrase) return [];
  return prisma.title.findMany({
    where: { OR: [{ title: { contains: phrase } }, { author: { contains: phrase } }, { category: { contains: phrase } }] },
    select: { id: true, title: true, author: true, category: true },
    orderBy: { title: "asc" },
    take: 8
  });
}

export async function readRecords(ids: string[]) {
  if (!ids.length) return [];
  return prisma.title.findMany({ where: { id: { in: ids } }, orderBy: { title: "asc" } });
}

export async function prepareShelfSave(id: string) {
  const title = await prisma.title.findUnique({ where: { id }, select: { id: true, title: true, author: true } });
  return title ? { pending: true as const, title } : null;
}
