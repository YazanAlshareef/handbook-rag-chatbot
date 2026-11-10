// npm run ingest            -> builds data/index.<provider>.db from data/docs/*.md
// npm run ingest -- --dry-run -> same, but with the offline fixture provider (no key)
import fs from "node:fs";
import path from "node:path";
import { chunkDoc, embedText, parseDoc } from "../lib/chunk";
import { providerName } from "../lib/config";
import { getProvider } from "../lib/llm";
import { indexPath } from "../lib/rag";
import { addChunks, createStore } from "../lib/store";

async function main() {
  if (process.argv.includes("--dry-run")) process.env.LLM_PROVIDER = "fixture";
  const name = providerName();
  const provider = getProvider(name);

  const dir = path.join(process.cwd(), "data", "docs");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("LICENSE")).sort();
  const chunks = files.flatMap((f) =>
    chunkDoc(parseDoc(f.replace(/\.md$/, ""), fs.readFileSync(path.join(dir, f), "utf8"))),
  );
  const sizes = chunks.map((c) => c.text.length);
  console.log(`${files.length} docs -> ${chunks.length} chunks (chars: min ${Math.min(...sizes)}, max ${Math.max(...sizes)}, avg ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)})`);

  const vectors = await provider.embed(chunks.map(embedText), "doc");

  const out = indexPath(name);
  fs.rmSync(out, { force: true });
  const db = createStore(out, provider.dim, name);
  addChunks(db, chunks, vectors);
  db.close();
  console.log(`wrote ${path.relative(process.cwd(), out)} (provider: ${name}, dim ${provider.dim})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
