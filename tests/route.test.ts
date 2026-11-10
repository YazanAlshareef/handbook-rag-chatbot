import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/ask/route";

let ip = 0;
const call = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "x-forwarded-for": `10.0.0.${++ip}`, ...headers },
      body,
    }),
  );
const q = (question: unknown) => JSON.stringify({ question });

test("valid question returns an answer without internal fields", async () => {
  const res = await call(q("Who can earn credit hours?"));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data.answer, "string");
  assert.ok(Array.isArray(data.citations));
  assert.equal("retrieved" in data, false);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("rejects bad JSON, wrong types and out-of-range lengths with 400", async () => {
  assert.equal((await call("not json")).status, 400);
  assert.equal((await call(q(42))).status, 400);
  assert.equal((await call(q("hi"))).status, 400);
  assert.equal((await call(q("   a   "))).status, 400);
  assert.equal((await call(q("a".repeat(501)))).status, 400);
});

test("rejects oversized bodies with 413", async () => {
  assert.equal((await call(q("a".repeat(5000)))).status, 413);
});

test("rate limit returns 429 with Retry-After after the per-minute cap", async () => {
  const same = { "x-forwarded-for": "203.0.113.9" };
  let last: Response | undefined;
  for (let i = 0; i < 12; i++) last = await call(q("What is FMLA?"), same);
  assert.equal(last!.status, 429);
  assert.ok(Number(last!.headers.get("retry-after")) >= 1);
});
