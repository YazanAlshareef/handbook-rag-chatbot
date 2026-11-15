import assert from "node:assert/strict";
import { test } from "node:test";

// own file: the daily counter is module state, so it must not share a process with route.test.ts
process.env.RATE_LIMIT_PER_DAY = "2";
process.env.RATE_LIMIT_PER_MINUTE = "1000";

const call = async (body: string) =>
  (await import("../app/api/ask/route")).POST(new Request("http://localhost/api/ask", { method: "POST", headers: { "x-forwarded-for": "192.0.2.1" }, body }));
const q = (question: string) => JSON.stringify({ question });

test("invalid requests do not use up the daily cap; valid ones do", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await call("not json")).status, 400);
  assert.equal((await call(q("Who can earn credit hours?"))).status, 200);
  assert.equal((await call(q("Who can earn credit hours?"))).status, 200);
  const third = await call(q("Who can earn credit hours?"));
  assert.equal(third.status, 429);
  assert.equal(third.headers.get("retry-after"), "3600");
});
