import assert from "node:assert/strict";
import { test } from "node:test";
import { REFUSAL } from "../lib/config";
import { getProvider, type Provider } from "../lib/llm";
import { ask, indexPath } from "../lib/rag";
import { openStore } from "../lib/store";

// Real fixture retrieval (so the score clears the threshold), stubbed model answer.
const db = openStore(indexPath("fixture"));
const stub = (text: string): Provider => ({ ...getProvider("fixture"), answer: async () => text });
const q = "How often must I change my ENT password?";

for (const [name, text] of [
  ["empty text", ""],
  ["text containing the refusal sentence", `${REFUSAL} [1]`],
  ["answer with no valid marker", "Every 90 days [99]."],
] as const) {
  test(`model-side refusal: ${name}`, async () => {
    const r = await ask(q, stub(text), db, 0);
    assert.equal(r.refused, true);
    assert.equal(r.answer, REFUSAL);
    assert.deepEqual(r.citations, []);
  });
}

test("control: a valid marker is not refused", async () => {
  const r = await ask(q, stub("Every 90 days [1]."), db, 0);
  assert.equal(r.refused, false);
  assert.deepEqual(r.citations.map((c) => c.n), [1]);
});
