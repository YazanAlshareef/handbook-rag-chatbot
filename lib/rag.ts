import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { REFUSAL, TOP_K, minScore, providerName, type ProviderName } from "./config";
import { getProvider, type Provider } from "./llm";
import { getMeta, openStore, search } from "./store";

export type Citation = {
  n: number;
  docId: string;
  docTitle: string;
  section: string;
  text: string;
  score: number;
};
export type Answer = {
  answer: string;
  refused: boolean;
  citations: Citation[];
  retrieved: Citation[]; // everything retrieval returned, cited or not (eval and debugging)
  topScore: number;
  provider: ProviderName;
};

export function indexPath(name: ProviderName): string {
  return path.join(process.cwd(), "data", `index.${name}.db`);
}

export async function ask(
  question: string,
  provider: Provider,
  db: DatabaseSync,
  threshold = minScore(provider.name),
): Promise<Answer> {
  const [qv] = await provider.embed([question], "query");
  const hits = search(db, qv, TOP_K);
  const topScore = hits[0]?.score ?? 0;
  const retrieved: Citation[] = hits.map((h, i) => ({
    n: i + 1,
    docId: h.docId,
    docTitle: h.docTitle,
    section: h.section,
    text: h.text,
    score: h.score,
  }));
  const base = { topScore, provider: provider.name, retrieved };
  if (topScore < threshold) return { ...base, answer: REFUSAL, refused: true, citations: [] };

  const cites = retrieved;
  const text = await provider.answer(
    question,
    cites.map((c) => ({ n: c.n, label: `${c.docTitle} > ${c.section}`, text: c.text })),
  );
  if (!text || text.includes(REFUSAL)) return { ...base, answer: REFUSAL, refused: true, citations: [] };

  // keep only passages the answer actually cites; if it cited none, show all it was given
  const used = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const cited = cites.filter((c) => used.has(c.n));
  return { ...base, answer: text, refused: false, citations: cited.length ? cited : cites };
}

// One provider + one open index per server process.
let engine: { provider: Provider; db: DatabaseSync } | undefined;

export function getEngine() {
  if (!engine) {
    const name = providerName();
    const provider = getProvider(name);
    const db = openStore(indexPath(name));
    const built = getMeta(db, "provider");
    if (built !== name || Number(getMeta(db, "dim")) !== provider.dim)
      throw new Error(`index was built with "${built}"; run npm run ingest for "${name}"`);
    engine = { provider, db };
  }
  return engine;
}
