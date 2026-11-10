// npm run eval -- --dry-run     offline fixture provider
// npm run eval                  uses LLM_PROVIDER from .env.local (needs a built index)
// Prints: answered / correct (key fact in the answer) / cited, refusals, and a threshold sweep.
// Questions marked split "tune" are for choosing the threshold; "test" are for reporting.
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
  must_contain: string[] | null; // lowercase phrases that must all appear in a correct answer
  split: "tune" | "test";
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
    const refused = r.topScore < threshold || r.refused;
    const isSource = (c: { docId: string; section: string }) =>
      c.docId === q.expected_doc && c.section.toLowerCase().includes((q.expected_section ?? "").toLowerCase());
    const sourceOk = q.expect === "answer" && r.citations.some(isSource); // citations = valid [n] markers only
    const retrievedOk = q.expect === "answer" && r.retrieved.some(isSource);
    const lower = r.answer.toLowerCase();
    const correct = q.expect === "answer" && !refused && (q.must_contain ?? []).every((f) => lower.includes(f));
    rows.push({ q, r, refused, sourceOk, retrievedOk, correct });
  }

  const report = (label: string, set: typeof rows) => {
    const should = set.filter((x) => x.q.expect === "answer");
    const shouldNot = set.filter((x) => x.q.expect === "refuse");
    console.log(`${label}: should answer ${should.length}`);
    console.log(`  not refused ${should.filter((x) => !x.refused).length}`);
    console.log(`  key fact in answer ${should.filter((x) => x.correct).length}`);
    console.log(`  expected source in top-${TOP_K} ${should.filter((x) => x.retrievedOk).length}`);
    console.log(`  expected source cited ${should.filter((x) => !x.refused && x.sourceOk).length}`);
    console.log(`  should refuse ${shouldNot.length}, refused ${shouldNot.filter((x) => x.refused).length}`);
  };
  console.log(`provider: ${name}   threshold: ${threshold}   questions: ${rows.length}`);
  report("all", rows);
  report("test split", rows.filter((x) => x.q.split === "test"));
  report("tune split", rows.filter((x) => x.q.split === "tune"));
  for (const x of rows) {
    const bad = x.q.expect === "answer" ? !x.correct || !x.sourceOk : !x.refused;
    if (bad) console.log(`  MISS ${x.q.id} [${x.q.type}/${x.q.split}] score ${x.r.topScore.toFixed(3)} refused=${x.refused} correct=${x.correct} cited=${x.sourceOk}  ${x.q.question}`);
  }

  // sweep on the tune split only: pick the threshold there, then read the test split above
  const tune = rows.filter((x) => x.q.split === "tune");
  const a = tune.filter((x) => x.q.expect === "answer").map((x) => x.r.topScore);
  const b = tune.filter((x) => x.q.expect === "refuse").map((x) => x.r.topScore);
  console.log("\nthreshold sweep on the tune split (answerable kept / refusals caught):");
  for (let t = 0.05; t < 0.95; t += 0.05) {
    console.log(`  ${t.toFixed(2)}  kept ${a.filter((s) => s >= t).length}/${a.length}  caught ${b.filter((s) => s < t).length}/${b.length}`);
  }
  const all = (e: "answer" | "refuse") => rows.filter((x) => x.q.expect === e).map((x) => x.r.topScore);
  console.log(`\n(all questions) lowest answerable score ${Math.min(...all("answer")).toFixed(3)}, highest should-refuse score ${Math.max(...all("refuse")).toFixed(3)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
