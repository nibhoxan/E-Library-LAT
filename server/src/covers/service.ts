import { prisma } from "../data/prisma.js";
import { isAllowedCoverUrl, lookupCover } from "./resolver.js";

const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PARALLEL_LOOKUPS = 3;

let active = 0;
const waiting: Array<() => void> = [];
async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL_LOOKUPS) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await job();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

const inFlight = new Map<string, Promise<string | null>>();

/** Returns the cover image URL for a title, looking it up once and remembering the answer in the database. */
export function getCoverUrl(titleId: string): Promise<string | null> {
  const running = inFlight.get(titleId);
  if (running) return running;
  const job = resolve(titleId).finally(() => inFlight.delete(titleId));
  inFlight.set(titleId, job);
  return job;
}

async function resolve(titleId: string): Promise<string | null> {
  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) return null;
  if (title.coverUrl && isAllowedCoverUrl(title.coverUrl)) return title.coverUrl;
  if (title.coverCheckedAt && Date.now() - title.coverCheckedAt.getTime() < RETRY_AFTER_MS) return null;

  const found = await limited(() => lookupCover({ title: title.title, author: title.author, gutenbergId: title.gutenbergId }));
  if (found.cacheable) {
    await prisma.title.update({ where: { id: title.id }, data: { coverUrl: found.url, coverCheckedAt: new Date() } });
  }
  return found.url;
}
