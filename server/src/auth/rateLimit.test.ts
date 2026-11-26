import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { createLimiter } from "./rateLimit.js";

function run(limit: ReturnType<typeof createLimiter>, key = "k") {
  let status = 200;
  let passed = false;
  const res = {
    setHeader() { return res; },
    status(code: number) { status = code; return res; },
    json() { return res; }
  } as unknown as Response;
  limit({ body: { key } } as unknown as Request, res, () => { passed = true; });
  return { status, passed };
}

test("allows up to max requests per window and then answers 429", () => {
  let time = 0;
  const limit = createLimiter({ windowMs: 1000, max: 3, key: () => "same", now: () => time });
  for (let i = 0; i < 3; i += 1) assert.equal(run(limit).passed, true);
  const blocked = run(limit);
  assert.equal(blocked.passed, false);
  assert.equal(blocked.status, 429);
  time = 1001;
  assert.equal(run(limit).passed, true);
});

test("keys are counted separately and a null key is not limited", () => {
  const limit = createLimiter({ windowMs: 1000, max: 1, key: (req) => (req.body as { key: string | null }).key });
  assert.equal(run(limit, "a").passed, true);
  assert.equal(run(limit, "b").passed, true);
  assert.equal(run(limit, "a").passed, false);
  for (let i = 0; i < 5; i += 1) assert.equal(run(limit, null as unknown as string).passed, true);
});
