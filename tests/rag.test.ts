import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { REFUSAL } from "../lib/config";
import { getProvider } from "../lib/llm";
import { ask, indexPath } from "../lib/rag";
import { openStore } from "../lib/store";

// These use the committed fixture index, so no key or network is needed.
const provider = getProvider("fixture");
const db = openStore(indexPath("fixture"));

test("answerable question returns a cited answer from the right document", async () => {
  const r = await ask("How often must I change my ENT password?", provider, db);
  assert.equal(r.refused, false);
  assert.ok(r.citations.length > 0);
  assert.ok(r.citations.some((c) => c.docId === "how-to-log-in"));
  assert.match(r.answer, /90 days/);
});

test("unrelated question is refused, not guessed", async () => {
  const r = await ask("What is the capital of France?", provider, db);
  assert.equal(r.refused, true);
  assert.equal(r.answer, REFUSAL);
  assert.deepEqual(r.citations, []);
});

test("threshold 1.1 refuses everything; threshold 0 never refuses on score", async () => {
  assert.equal((await ask("FMLA weeks", provider, db, 1.1)).refused, true);
  assert.equal((await ask("FMLA weeks", provider, db, 0)).refused, false);
});

test("openStore fails on a missing index instead of creating an empty one", () => {
  const missing = path.join(os.tmpdir(), `nope-${Date.now()}.db`);
  assert.throws(() => openStore(missing));
  assert.equal(fs.existsSync(missing), false);
});
