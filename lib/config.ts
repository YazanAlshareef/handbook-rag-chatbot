// All tunable numbers live here so the README can point at one file.

export const CHUNK_MAX_CHARS = 900; // ~200 tokens: one policy paragraph or a short list
export const CHUNK_OVERLAP_CHARS = 150; // ~15%: keeps a sentence cut at the edge findable
export const MIN_CHUNK_CHARS = 40;
export const TOP_K = 4;

export const MAX_QUESTION_CHARS = 500;
export const MIN_QUESTION_CHARS = 3;
export const MAX_BODY_BYTES = 4096;

export const REFUSAL = "I can't find that in the documents.";

export type ProviderName = "gemini" | "fixture";

export function providerName(): ProviderName {
  const v = (process.env.LLM_PROVIDER ?? "fixture").toLowerCase();
  if (v === "gemini" || v === "fixture") return v;
  throw new Error(`LLM_PROVIDER must be "gemini" or "fixture", got "${v}"`);
}

// Below this top cosine score the app refuses instead of answering.
// fixture: calibrated on eval/questions.jsonl (see README).
// gemini: a starting guess, NOT calibrated (no live key was available).
const DEFAULT_MIN_SCORE: Record<ProviderName, number> = {
  fixture: 0.2,
  gemini: 0.6,
};

export function minScore(name: ProviderName): number {
  const raw = process.env.RAG_MIN_SCORE;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return DEFAULT_MIN_SCORE[name];
}

export function rateLimitPerMinute(): number {
  const n = Number(process.env.RATE_LIMIT_PER_MINUTE);
  return Number.isInteger(n) && n > 0 ? n : 10;
}
