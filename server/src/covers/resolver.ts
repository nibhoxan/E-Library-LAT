/**
 * Finds a cover image for a book. Open Library is tried first (real edition covers, searched by title and author),
 * then Project Gutenberg's cover for books that have a Gutenberg id. Only these two hosts are ever returned.
 */
export type CoverLookup = { url: string | null; cacheable: boolean };
export type CoverWork = { title: string; author: string; gutenbergId: number | null };

const TIMEOUT_MS = 6000;
const USER_AGENT = "ReadingRoom/1.0 (school project; public-domain library)";
const ALLOWED_HOSTS = new Set(["covers.openlibrary.org", "www.gutenberg.org"]);
const NO_AUTHOR = /^(various( authors)?|anonymous|unknown|n\/a)$/i;

export const gutenbergCoverUrl = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
export const openLibraryCoverUrl = (coverId: number) => `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;

export function isAllowedCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

async function timedFetch(fetchImpl: typeof fetch, url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, headers: { "user-agent": USER_AGENT, accept: "application/json, image/*" }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const transient = (status: number) => status === 429 || status >= 500;

export async function lookupCover(work: CoverWork, fetchImpl: typeof fetch = fetch): Promise<CoverLookup> {
  let hadTransientError = false;

  try {
    const params = new URLSearchParams({ title: work.title, limit: "5", fields: "title,cover_i" });
    if (work.author && !NO_AUTHOR.test(work.author.trim())) params.set("author", work.author);
    const response = await timedFetch(fetchImpl, `https://openlibrary.org/search.json?${params}`);
    if (response.ok) {
      const body = (await response.json()) as { docs?: Array<{ cover_i?: unknown }> };
      const hit = body.docs?.find((doc) => typeof doc.cover_i === "number" && doc.cover_i > 0);
      if (hit) return { url: openLibraryCoverUrl(hit.cover_i as number), cacheable: true };
    } else if (transient(response.status)) {
      hadTransientError = true;
    }
  } catch {
    hadTransientError = true;
  }

  if (work.gutenbergId) {
    try {
      const url = gutenbergCoverUrl(work.gutenbergId);
      const response = await timedFetch(fetchImpl, url, { method: "HEAD" });
      if (response.ok && (response.headers.get("content-type") ?? "").startsWith("image/")) return { url, cacheable: true };
      if (transient(response.status)) hadTransientError = true;
    } catch {
      hadTransientError = true;
    }
  }

  // A miss caused by a network problem or rate limit is not remembered, so it is tried again later.
  return { url: null, cacheable: !hadTransientError };
}
