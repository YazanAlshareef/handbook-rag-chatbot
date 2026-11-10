// npm run eval -- --dry-run     offline fixture provider
// npm run eval                  uses LLM_PROVIDER from .env.local (needs a built index)
// Prints: refusal accuracy, cited-source accuracy, and a threshold sweep over top retrieval scores.
import fs from "node:fs";
import path from "node:path";
import { TOP_K, minScore, providerName } from "../lib/config";
import { ask, getEngine } from "../lib/rag";

type Q = {
  id: string;
  type: "answerable" | "unanswerable" | "tricky";
  question: string;
  expect: "answer" | "refuse";
  expected_doc: string | null;
  expected_section: string | null;
};

async function main() {
  if (process.argv.includes("--dry-run")) process.env.LLM_PROVIDER = "fixture";
  const name = providerName();
  const threshold = minScore(name);
  const qs: Q[] = fs
    .readFileSync(path.join(process.cwd(), "eval", "questions.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const { provider, db } = getEngine();

  const rows = [];
  for (const q of qs) {
    // threshold 0 so every top score is recorded; the real decision is re-applied below
    const r = await ask(q.question, provider, db, 0);
    const refusedAtThreshold = r.topScore < threshold || r.refused;
    const sourceOk =
      q.expect === "answer" &&
      r.citations.some(
        (c) =>
          c.docId === q.expected_doc &&
          c.section.toLowerCase().includes((q.expected_section ?? "").toLowerCase()),
      );
    const retrievedOk = q.expect === "answer" && r.retrieved.some((c) => c.docId === q.expected_doc && c.section.toLowerCase().includes((q.expected_section ?? "").toLowerCase()));
    rows.push({ q, r, refused: refusedAtThreshold, sourceOk, retrievedOk });
  }

  const should = rows.filter((x) => x.q.expect === "answer");
  const shouldNot = rows.filter((x) => x.q.expect === "refuse");
  const answeredOk = should.filter((x) => !x.refused);
  console.log(`provider: ${name}   threshold: ${threshold}   questions: ${rows.length}`);
  console.log(`should answer: ${should.length}  answered: ${answeredOk.length}  expected source in top-${TOP_K}: ${should.filter((x) => x.retrievedOk).length}  cited: ${should.filter((x) => !x.refused && x.sourceOk).length}`);
  console.log(`should refuse: ${shouldNot.length}  refused: ${shouldNot.filter((x) => x.refused).length}`);
  for (const x of rows) {
    const bad = x.q.expect === "answer" ? x.refused || !x.sourceOk : !x.refused;
    if (bad) console.log(`  MISS ${x.q.id} [${x.q.type}] score ${x.r.topScore.toFixed(3)} refused=${x.refused}  ${x.q.question}`);
  }

  console.log("\nthreshold sweep (answerable kept / refusals caught):");
  const a = should.map((x) => x.r.topScore);
  const b = shouldNot.map((x) => x.r.topScore);
  for (let t = 0.05; t < 0.95; t += 0.05) {
    const kept = a.filter((s) => s >= t).length;
    const caught = b.filter((s) => s < t).length;
    console.log(`  ${t.toFixed(2)}  kept ${kept}/${a.length}  caught ${caught}/${b.length}`);
  }
  console.log(`\nlowest answerable score ${Math.min(...a).toFixed(3)}, highest should-refuse score ${Math.max(...b).toFixed(3)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
