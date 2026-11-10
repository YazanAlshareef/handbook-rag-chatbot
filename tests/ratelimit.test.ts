import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyCap, rateLimit } from "../lib/ratelimit";

test("allows up to the limit, then blocks with a Retry-After", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("a", 3, t0 + i).ok, true);
  const blocked = rateLimit("a", 3, t0 + 10);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1 && blocked.retryAfterSec <= 60);
});

test("window slides: allowed again after 60 seconds", () => {
  const t0 = 2_000_000;
  rateLimit("b", 1, t0);
  assert.equal(rateLimit("b", 1, t0 + 1000).ok, false);
  assert.equal(rateLimit("b", 1, t0 + 61_000).ok, true);
});

test("keys are counted separately", () => {
  const t0 = 3_000_000;
  rateLimit("c", 1, t0);
  assert.equal(rateLimit("d", 1, t0).ok, true);
});

test("daily cap counts everyone together and resets after 24 hours", () => {
  const t0 = 9_000_000_000;
  assert.equal(dailyCap(2, t0), true);
  assert.equal(dailyCap(2, t0 + 1), true);
  assert.equal(dailyCap(2, t0 + 2), false);
  assert.equal(dailyCap(2, t0 + 86_400_001), true);
});
