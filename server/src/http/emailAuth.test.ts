import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import pg from "pg";

// End-to-end test of the email verification and password reset routes. It needs a Postgres database:
//   DATABASE_URL=postgresql://readingroom:readingroom@localhost:5432/readingroom_test npm test --workspace server
// Brevo is never contacted: the HTTP call to api.brevo.com is intercepted and the code is read from it.
const enabled = Boolean(process.env.DATABASE_URL);
const skip = enabled ? false : "set DATABASE_URL to run the database tests";

process.env.BREVO_API_KEY = "test-key";
process.env.BREVO_SENDER_EMAIL = "sender@example.com";

const realFetch = globalThis.fetch;
const sent: Array<{ to: string; subject: string; code: string; apiKey: string }> = [];
let base = "";
let counter = 0;
let closeServer = async () => {};
let db: pg.Client;
let schemaModule: typeof import("../data/schema.js");

before(async () => {
  if (!enabled) return;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).startsWith("https://api.brevo.com/")) {
      const body = JSON.parse(String(init?.body));
      sent.push({
        to: body.to[0].email, subject: body.subject,
        code: /\b(\d{6})\b/.exec(body.textContent ?? body.htmlContent)?.[1] ?? "",
        apiKey: (init?.headers as Record<string, string>)["api-key"]
      });
      return new Response("{}", { status: 201 });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  schemaModule = await import("../data/schema.js");
  const { poolConfig } = await import("../data/prisma.js");
  await schemaModule.ensureSchema();
  db = new pg.Client(poolConfig());
  await db.connect();
  const { app } = await import("../app.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/session`;
  closeServer = async () => {
    await new Promise((resolve) => server.close(resolve));
    const { prisma } = await import("../data/prisma.js");
    await prisma.$disconnect();
    await db.end();
  };
});

after(async () => {
  globalThis.fetch = realFetch;
  await closeServer();
});

const unique = () => `reader${Date.now()}${counter++}@example.com`;
let ipCounter = 10;

async function post(path: string, body: unknown) {
  // A distinct client address per request keeps the per-address limiter out of the way. The per-email limiter is still active.
  const response = await realFetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipCounter++ % 250}` },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
const emailsTo = (email: string) => sent.filter((message) => message.to === email);
const lastCode = (email: string) => emailsTo(email).at(-1)?.code ?? "";
const wrongCode = (code: string) => (code === "000000" ? "000001" : "000000");

test("register sends a verification email through Brevo and issues no session", { skip }, async () => {
  const email = unique();
  const result = await post("/register", { name: "Test Reader", email, password: "password123" });
  assert.equal(result.status, 201);
  assert.equal(result.body.verificationRequired, true);
  assert.equal(result.body.emailSent, true);
  assert.equal(result.body.token, undefined);
  assert.equal(emailsTo(email).length, 1);
  assert.equal(emailsTo(email)[0].apiKey, "test-key");
  assert.match(lastCode(email), /^\d{6}$/);
  const row = await db.query(`SELECT "codeHash" FROM "EmailCode" WHERE "readerId" = (SELECT id FROM "Reader" WHERE email = $1)`, [email]);
  assert.ok(!row.rows[0].codeHash.includes(lastCode(email)));
});

test("login is refused until the email is verified, then verification signs the reader in once", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "Test Reader", email, password: "password123" });

  const blocked = await post("/login", { email, password: "password123" });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "EMAIL_NOT_VERIFIED");
  assert.equal(emailsTo(email).length, 1, "a second code is not sent inside the 60 second cooldown");

  const wrong = await post("/verify-email", { email, code: wrongCode(lastCode(email)) });
  assert.equal(wrong.status, 400);

  const code = lastCode(email);
  const ok = await post("/verify-email", { email, code });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.reader.email, email);

  const reused = await post("/verify-email", { email, code });
  assert.equal(reused.status, 400, "a code works only once");

  const login = await post("/login", { email, password: "password123" });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
});

test("five wrong guesses lock the code, even if the right one is sent afterwards", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "Test Reader", email, password: "password123" });
  const code = lastCode(email);
  for (let i = 0; i < 5; i += 1) assert.equal((await post("/verify-email", { email, code: wrongCode(code) })).status, 400);
  assert.equal((await post("/verify-email", { email, code })).status, 400);
});

test("an expired code is rejected", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "Test Reader", email, password: "password123" });
  await db.query(`UPDATE "EmailCode" SET "expiresAt" = now() - interval '1 minute' WHERE "readerId" = (SELECT id FROM "Reader" WHERE email = $1)`, [email]);
  assert.equal((await post("/verify-email", { email, code: lastCode(email) })).status, 400);
});

test("resend respects the cooldown, then replaces the old code", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "Test Reader", email, password: "password123" });
  const first = lastCode(email);
  const early = await post("/resend-code", { email });
  assert.equal(early.status, 200);
  assert.equal(emailsTo(email).length, 1, "no email inside the cooldown");

  await db.query(`UPDATE "EmailCode" SET "createdAt" = now() - interval '61 seconds' WHERE "readerId" = (SELECT id FROM "Reader" WHERE email = $1)`, [email]);
  await post("/resend-code", { email });
  assert.equal(emailsTo(email).length, 2);
  const second = lastCode(email);
  if (second !== first) assert.equal((await post("/verify-email", { email, code: first })).status, 400, "the old code stops working");
  assert.equal((await post("/verify-email", { email, code: second })).status, 200);
});

test("registering again before verifying replaces the unverified sign-up; a verified email is refused", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "First", email, password: "password123" });
  const again = await post("/register", { name: "Second", email, password: "different456" });
  assert.equal(again.status, 201);
  await db.query(`UPDATE "EmailCode" SET "createdAt" = now() - interval '61 seconds' WHERE "readerId" = (SELECT id FROM "Reader" WHERE email = $1)`, [email]);
  await post("/resend-code", { email });
  await post("/verify-email", { email, code: lastCode(email) });
  assert.equal((await post("/login", { email, password: "password123" })).status, 401, "the first password was replaced");
  assert.equal((await post("/login", { email, password: "different456" })).status, 200);
  assert.equal((await post("/register", { name: "Third", email, password: "password789" })).status, 409);
});

test("forgot-password answers the same for unknown and known accounts and only emails real ones", { skip }, async () => {
  const known = unique();
  await post("/register", { name: "Test Reader", email: known, password: "password123" });
  await post("/verify-email", { email: known, code: lastCode(known) });
  const unknown = unique();

  const a = await post("/forgot-password", { email: unknown });
  const b = await post("/forgot-password", { email: known });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  assert.equal(emailsTo(unknown).length, 0);
  assert.equal(emailsTo(known).length, 2);
  assert.match(emailsTo(known)[1].subject, /Reset your password/);
});

test("reset-password needs the right code and a strong enough password, then replaces the password", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "Test Reader", email, password: "password123" });
  await post("/verify-email", { email, code: lastCode(email) });
  await post("/forgot-password", { email });
  const code = lastCode(email);

  assert.equal((await post("/reset-password", { email, code, newPassword: "short" })).status, 400);
  assert.equal((await post("/reset-password", { email, code: wrongCode(code), newPassword: "brandnew123" })).status, 400);
  const done = await post("/reset-password", { email, code, newPassword: "brandnew123" });
  assert.equal(done.status, 200);
  assert.equal((await post("/reset-password", { email, code, newPassword: "another12345" })).status, 400, "the code works once");

  assert.equal((await post("/login", { email, password: "password123" })).status, 401);
  assert.equal((await post("/login", { email, password: "brandnew123" })).status, 200);
});

test("a reset code also verifies an account that never finished verification", { skip }, async () => {
  const email = unique();
  await post("/register", { name: "Test Reader", email, password: "password123" });
  await db.query(`UPDATE "EmailCode" SET "createdAt" = now() - interval '61 seconds' WHERE "readerId" = (SELECT id FROM "Reader" WHERE email = $1)`, [email]);
  await post("/forgot-password", { email });
  assert.equal((await post("/reset-password", { email, code: lastCode(email), newPassword: "brandnew123" })).status, 200);
  assert.equal((await post("/login", { email, password: "brandnew123" })).status, 200);
});

test("an email that cannot be delivered still creates the account and reports emailSent: false", { skip }, async () => {
  const email = unique();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input).startsWith("https://api.brevo.com/") ? new Response("{}", { status: 400 }) : realFetch(input, init)) as typeof fetch;
  try {
    const result = await post("/register", { name: "Test Reader", email, password: "password123" });
    assert.equal(result.status, 201);
    assert.equal(result.body.emailSent, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("the per-email limiter answers 429 after repeated requests", { skip }, async () => {
  const email = unique();
  let last = 0;
  for (let i = 0; i < 14; i += 1) last = (await post("/forgot-password", { email })).status;
  assert.equal(last, 429);
});

test("the migration verifies accounts that existed before, once, and later sign-ups stay unverified", { skip }, async () => {
  const oldEmail = unique();
  await db.query(`INSERT INTO "Reader" (id, email, name, "passwordHash") VALUES ($1, $2, 'Old Reader', 'x')`, [`old${Date.now()}${counter}`, oldEmail]);
  await db.query(`ALTER TABLE "Reader" DROP COLUMN "emailVerifiedAt"`);
  await schemaModule.ensureSchema();
  const migrated = await db.query(`SELECT "emailVerifiedAt" FROM "Reader" WHERE email = $1`, [oldEmail]);
  assert.ok(migrated.rows[0].emailVerifiedAt, "existing account is verified by the migration");

  const newEmail = unique();
  await post("/register", { name: "New Reader", email: newEmail, password: "password123" });
  await schemaModule.ensureSchema();
  const later = await db.query(`SELECT "emailVerifiedAt" FROM "Reader" WHERE email = $1`, [newEmail]);
  assert.equal(later.rows[0].emailVerifiedAt, null, "running the schema step again does not verify new sign-ups");
});
