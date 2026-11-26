import assert from "node:assert/strict";
import { test } from "node:test";
import { CODE_LENGTH, CODE_TTL_MINUTES, codeMatches, expiryFrom, generateCode, hashCode, normalizeCode } from "./codes.js";

test("generateCode returns a zero-padded 6 digit string", () => {
  for (let i = 0; i < 200; i += 1) assert.match(generateCode(), new RegExp(`^\\d{${CODE_LENGTH}}$`));
});

test("generateCode is not constant", () => {
  const seen = new Set(Array.from({ length: 50 }, () => generateCode()));
  assert.ok(seen.size > 40);
});

test("hash is bound to reader and purpose and never contains the code", () => {
  const hash = hashCode("reader-1", "verify", "123456");
  assert.ok(!hash.includes("123456"));
  assert.ok(codeMatches(hash, "reader-1", "verify", "123456"));
  assert.ok(!codeMatches(hash, "reader-1", "verify", "123457"));
  assert.ok(!codeMatches(hash, "reader-2", "verify", "123456"));
  assert.ok(!codeMatches(hash, "reader-1", "reset", "123456"));
});

test("normalizeCode accepts digits with spaces and rejects everything else", () => {
  assert.equal(normalizeCode("123 456"), "123456");
  assert.equal(normalizeCode(" 000001 "), "000001");
  for (const bad of ["12345", "1234567", "abcdef", "12345a", "", null, undefined, 123456]) assert.equal(normalizeCode(bad), null);
});

test("expiryFrom adds the configured lifetime", () => {
  const start = new Date("2026-11-26T10:00:00Z");
  assert.equal(expiryFrom(start).getTime() - start.getTime(), CODE_TTL_MINUTES * 60_000);
});
