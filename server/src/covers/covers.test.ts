import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import pg from "pg";
import { gutenbergCoverUrl, isAllowedCoverUrl, lookupCover, openLibraryCoverUrl } from "./resolver.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const requested: string[] = [];
function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => { requested.push(String(input)); return handler(String(input), init); }) as typeof fetch;
}

test("uses the first Open Library result that has a cover, searching by title and author", async () => {
  requested.length = 0;
  const found = await lookupCover({ title: "Walden", author: "Henry David Thoreau", gutenbergId: null },
    fakeFetch(() => json({ docs: [{ title: "x" }, { cover_i: 8231856 }, { cover_i: 1 }] })));
  assert.deepEqual(found, { url: openLibraryCoverUrl(8231856), cacheable: true });
  const search = new URL(requested[0]);
  assert.equal(search.hostname, "openlibrary.org");
  assert.equal(search.searchParams.get("title"), "Walden");
  assert.equal(search.searchParams.get("author"), "Henry David Thoreau");
});

test("does not search by author for 'Various Authors'", async () => {
  requested.length = 0;
  await lookupCover({ title: "The Story of Literature", author: "Various Authors", gutenbergId: null }, fakeFetch(() => json({ docs: [] })));
  assert.equal(new URL(requested[0]).searchParams.has("author"), false);
});

test("falls back to the Gutenberg cover when Open Library has none and the image exists", async () => {
  const found = await lookupCover({ title: "Nature", author: "Ralph Waldo Emerson", gutenbergId: 29433 },
    fakeFetch((url) => url.startsWith("https://openlibrary.org/")
      ? json({ docs: [] })
      : new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } })));
  assert.deepEqual(found, { url: gutenbergCoverUrl(29433), cacheable: true });
});

test("a definite miss is cacheable; a network error or rate limit is not", async () => {
  const work = { title: "Nothing", author: "Nobody", gutenbergId: null };
  assert.deepEqual(await lookupCover(work, fakeFetch(() => json({ docs: [] }))), { url: null, cacheable: true });
  assert.deepEqual(await lookupCover(work, fakeFetch(() => { throw new TypeError("offline"); })), { url: null, cacheable: false });
  assert.deepEqual(await lookupCover(work, fakeFetch(() => json({}, 429))), { url: null, cacheable: false });
});

test("only the two cover hosts over https are allowed", () => {
  assert.equal(isAllowedCoverUrl(openLibraryCoverUrl(1)), true);
  assert.equal(isAllowedCoverUrl(gutenbergCoverUrl(1)), true);
  for (const bad of ["http://covers.openlibrary.org/b/id/1-M.jpg", "https://evil.example/x.jpg", "javascript:alert(1)", "not a url"]) assert.equal(isAllowedCoverUrl(bad), false);
});

// ---- route test (needs Postgres)
const skip = process.env.DATABASE_URL ? false : "set DATABASE_URL to run the database tests";
const realFetch = globalThis.fetch;
let outbound = 0;
let base = "";
let db: pg.Client;
let closeServer = async () => {};

before(async () => {
  if (skip) return;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://openlibrary.org/")) {
      outbound += 1;
      return new URL(url).searchParams.get("title") === "Has A Cover" ? json({ docs: [{ cover_i: 4242 }] }) : json({ docs: [] });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  const { ensureSchema } = await import("../data/schema.js");
  const { poolConfig, prisma } = await import("../data/prisma.js");
  await ensureSchema();
  db = new pg.Client(poolConfig());
  await db.connect();
  const { app } = await import("../app.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/titles`;
  closeServer = async () => { await new Promise((resolve) => server.close(resolve)); await prisma.$disconnect(); await db.end(); };
});
after(async () => { globalThis.fetch = realFetch; await closeServer(); });

async function addTitle(id: string, title: string) {
  await db.query(`DELETE FROM "Title" WHERE id = $1`, [id]);
  await db.query(`INSERT INTO "Title" (id, title, author, category, summary, "updatedAt") VALUES ($1, $2, 'Test Author', 'Fiction', 's', now())`, [id, title]);
}
const get = (path: string) => realFetch(`${base}${path}`, { redirect: "manual" });

test("cover route redirects to the found cover and remembers it", { skip }, async () => {
  await addTitle("cover-hit", "Has A Cover");
  outbound = 0;
  const first = await get("/cover-hit/cover");
  assert.equal(first.status, 302);
  assert.equal(first.headers.get("location"), openLibraryCoverUrl(4242));
  const second = await get("/cover-hit/cover");
  assert.equal(second.status, 302);
  assert.equal(outbound, 1, "the second request is answered from the database");
  const row = await db.query(`SELECT "coverUrl" FROM "Title" WHERE id = 'cover-hit'`);
  assert.equal(row.rows[0].coverUrl, openLibraryCoverUrl(4242));
});

test("cover route answers 404 for a book without a cover and does not search again", { skip }, async () => {
  await addTitle("cover-miss", "No Cover Anywhere");
  outbound = 0;
  assert.equal((await get("/cover-miss/cover")).status, 404);
  assert.equal((await get("/cover-miss/cover")).status, 404);
  assert.equal(outbound, 1);
});

test("cover route answers 404 for an unknown title", { skip }, async () => {
  assert.equal((await get("/does-not-exist/cover")).status, 404);
});

test("simultaneous requests for one title share a single lookup", { skip }, async () => {
  await addTitle("cover-burst", "Has A Cover");
  outbound = 0;
  const results = await Promise.all(Array.from({ length: 6 }, () => get("/cover-burst/cover")));
  assert.ok(results.every((response) => response.status === 302));
  assert.equal(outbound, 1);
});
