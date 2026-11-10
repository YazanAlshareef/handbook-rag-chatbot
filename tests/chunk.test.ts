import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkDoc, parseDoc } from "../lib/chunk";
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, MIN_CHUNK_CHARS } from "../lib/config";

const RAW = `---
title: Sample &amp; Test
---
# Sample

Intro paragraph that is long enough to survive the minimum chunk size filter easily.

## Leave

See [the policy](https://example.com) for details. {% include foo %} Employees earn four hours per pay period.

### Sick

Sick leave is earned at the same rate for everyone, and it carries over each year.
`;

test("parseDoc takes the title, decodes &amp; and strips links and liquid tags", () => {
  const d = parseDoc("sample", RAW);
  assert.equal(d.title, "Sample & Test");
  assert.ok(d.text.includes("See the policy for details."));
  assert.ok(!d.text.includes("{%"));
  assert.ok(!d.text.includes("https://example.com"));
});

test("chunkDoc keeps section paths and respects the size limits", () => {
  const chunks = chunkDoc(parseDoc("sample", RAW));
  assert.ok(chunks.some((c) => c.section.endsWith("Leave > Sick")));
  for (const c of chunks) {
    assert.ok(c.text.length >= MIN_CHUNK_CHARS, `too short: ${c.text}`);
    assert.ok(c.text.length <= CHUNK_MAX_CHARS + 200, `too long: ${c.text.length}`);
    assert.equal(c.docId, "sample");
  }
});

test("a long section is split and neighbouring chunks overlap", () => {
  const sentence = "Employees must follow the written rule for every request they make. ";
  const doc = { id: "long", title: "Long", text: `## Rules\n\n${sentence.repeat(40)}` };
  const chunks = chunkDoc(doc);
  assert.ok(chunks.length > 1);
  const tail = chunks[0].text.slice(-60);
  assert.ok(chunks[1].text.includes(tail.trim().slice(-30)), "second chunk should repeat the end of the first");
});

test("a long piece with no sentence ends is split, not truncated", () => {
  const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
  const doc = parseDoc("long", `# Long\n\n${words.join(" ")}`);
  const chunks = chunkDoc(doc);
  assert.ok(chunks.length > 1);
  const seen = new Set(chunks.flatMap((c) => c.text.split(/\s+/)));
  for (const w of words) assert.ok(seen.has(w), `${w} lost`);
  for (const c of chunks) assert.ok(c.text.length <= CHUNK_MAX_CHARS + CHUNK_OVERLAP_CHARS + 2);
});
