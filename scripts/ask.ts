// npm run ask -- "how many hours of comp time can I earn?"   (add --dry-run for the offline provider)
import { providerName } from "../lib/config";
import { ask, getEngine } from "../lib/rag";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--dry-run")) process.env.LLM_PROVIDER = "fixture";
  const question = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!question) throw new Error('usage: npm run ask -- "your question" [--dry-run]');

  const { provider, db } = getEngine();
  const r = await ask(question, provider, db);
  console.log(`[${providerName()}] top score ${r.topScore.toFixed(3)}${r.refused ? " (refused)" : ""}`);
  console.log(r.answer);
  for (const c of r.citations) console.log(`  [${c.n}] ${c.docTitle} > ${c.section}  (${c.score.toFixed(3)})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
