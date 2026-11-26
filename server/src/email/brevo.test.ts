import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { EmailSendError, codeEmail, sendEmail } from "./brevo.js";

const realFetch = globalThis.fetch;
const saved = { key: process.env.BREVO_API_KEY, sender: process.env.BREVO_SENDER_EMAIL, env: process.env.NODE_ENV };

beforeEach(() => {
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.com";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [name, value] of [["BREVO_API_KEY", saved.key], ["BREVO_SENDER_EMAIL", saved.sender], ["NODE_ENV", saved.env]] as const) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test("posts the message to Brevo with the api-key header and verified sender", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => { captured = { url, init }; return new Response("{}", { status: 201 }); }) as typeof fetch;
  await sendEmail({ to: "reader@example.com", subject: "Hello", html: "<p>Hi</p>" });
  assert.equal(captured?.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal((captured?.init.headers as Record<string, string>)["api-key"], "test-key");
  const body = JSON.parse(String(captured?.init.body));
  assert.deepEqual(body.sender, { name: "Reading Room", email: "sender@example.com" });
  assert.deepEqual(body.to, [{ email: "reader@example.com" }]);
  assert.equal(body.subject, "Hello");
  assert.equal(body.htmlContent, "<p>Hi</p>");
});

test("a Brevo error becomes an EmailSendError that does not include the key", async () => {
  globalThis.fetch = (async () => new Response("{}", { status: 401 })) as typeof fetch;
  await assert.rejects(sendEmail({ to: "a@b.co", subject: "s", html: "h" }), (error: Error) => {
    assert.ok(error instanceof EmailSendError);
    assert.ok(!error.message.includes("test-key"));
    return true;
  });
});

test("a network failure becomes an EmailSendError", async () => {
  globalThis.fetch = (async () => { throw new TypeError("network down"); }) as typeof fetch;
  await assert.rejects(sendEmail({ to: "a@b.co", subject: "s", html: "h" }), EmailSendError);
});

test("without an API key, development prints the email and production refuses", async () => {
  delete process.env.BREVO_API_KEY;
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
  process.env.NODE_ENV = "development";
  await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "dev text" });
  assert.equal(called, false);
  process.env.NODE_ENV = "production";
  await assert.rejects(sendEmail({ to: "a@b.co", subject: "s", html: "h" }), EmailSendError);
});

test("code emails escape the reader's name and contain the code", () => {
  const message = codeEmail("verify", `<script>alert(1)</script>`, "042517", 10);
  assert.ok(!message.html.includes("<script>"));
  assert.ok(message.html.includes("&lt;script&gt;"));
  assert.ok(message.html.includes("042517"));
  assert.ok(message.text?.includes("042517"));
});
