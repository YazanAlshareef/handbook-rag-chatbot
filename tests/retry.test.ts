import assert from "node:assert/strict";
import { test } from "node:test";
import { withRetry } from "../lib/llm";

const failing = (errors: unknown[]) => {
  let calls = 0;
  const fn = async () => {
    const e = errors[calls++];
    if (e !== undefined) throw e;
    return "ok";
  };
  return { fn, calls: () => calls };
};

test("retries an error with no status (timeout) and then succeeds", async () => {
  const t = failing([new Error("timeout")]);
  assert.equal(await withRetry(t.fn, 3, 1), "ok");
  assert.equal(t.calls(), 2);
});

test("retries 429 and 5xx, gives up after the last try", async () => {
  const t = failing([{ status: 429 }, { status: 503 }, { status: 500 }]);
  await assert.rejects(withRetry(t.fn, 3, 1));
  assert.equal(t.calls(), 3);
});

test("does not retry a 400 or 401", async () => {
  const t = failing([{ status: 401 }]);
  await assert.rejects(withRetry(t.fn, 3, 1));
  assert.equal(t.calls(), 1);
});
