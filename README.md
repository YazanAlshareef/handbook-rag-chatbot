# Ask the Handbook

A small "ask a document set" app. You type a question, it finds the most relevant passages in a set of handbook pages, and answers using only those passages. Every answer shows the passages it came from. If the pages do not cover the question, it says **"I can't find that in the documents."** instead of guessing.

**Status: not run with a live model key.** Everything below was run in the offline demo mode (see [Demo mode](#demo-mode-no-key-needed)). The Gemini code path is written against the current `@google/genai` docs but has never been called for real. Treat its refusal threshold as a guess until you calibrate it.

## The documents

The corpus is 12 pages of the [GSA-TTS handbook](https://github.com/GSA-TTS/handbook) (leave, FMLA, paid parental leave, overtime, logging in, PIV cards, equipment, Google Drive, privacy, and so on).

- Source: `GSA-TTS/handbook`, commit `c220f93896b39e9e4ab0f486a1d5bf346ac06e3e` (also stored in `data/docs/.source-commit`).
- Licence: US government work, public domain in the US, and the repo also carries CC0 1.0. Copy is in `data/docs/LICENSE-CC0.md`.
- I cleaned the markdown (front matter, Jekyll tags, link syntax) but did not change the wording.

## How it works

1. **Load and clean** (`lib/chunk.ts`): read each markdown file, strip front matter and template tags, keep the heading structure.
2. **Chunk** (`lib/chunk.ts`): split by heading first, then by paragraph and sentence. Max 900 characters (about 200 tokens: one policy paragraph or a short list), 150 characters of overlap inside a section (so a sentence cut at the edge is still findable), and chunks under 40 characters are dropped (they were link-only stubs like "See InSite page."). These sizes are reasoned, not tuned; I did not run an experiment on them.
3. **Embed** (`lib/llm.ts`): the only file that knows about a model provider. Switch with `LLM_PROVIDER` (`gemini` or `fixture`).
4. **Store** (`lib/store.ts`): SQLite with the `sqlite-vec` extension, using Node's built-in `node:sqlite`. Cosine distance.
5. **Retrieve and answer** (`lib/rag.ts`): top 4 chunks. If the best score is below the threshold, refuse without calling the model. Otherwise the model answers from those passages with `[n]` markers, and the UI shows only the passages that were cited. If the model returns the refusal sentence or an empty answer, that is a refusal too.
6. **Serve** (`app/api/ask/route.ts`, `app/page.tsx`): a Next.js route and a chat page.

The model key lives only on the server (`.env.local`, git-ignored). The browser never sees it and the route never returns it.

## Run it

Needs Node 22.13 or newer (for `node:sqlite` extension loading).

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `.env.local` it runs in demo mode.

### With Gemini

1. Copy `.env.example` to `.env.local`.
2. Set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY=...`. Model names come from `GEMINI_EMBED_MODEL` and `GEMINI_CHAT_MODEL`.
3. Build the Gemini index (this calls the embedding API): `npm run ingest`
4. `npm run dev`
5. Run `npm run eval` and look at the threshold sweep at the end. Set `RAG_MIN_SCORE` from that, not from my default of 0.6.

`data/index.gemini.db` is git-ignored. On Vercel, set the same env vars in the project settings and commit or otherwise ship the built index.

### Other commands

```bash
npm run ask -- "How many weeks of FMLA?" --dry-run   # one question from the terminal
npm run ingest -- --dry-run                          # rebuild the offline index
npm run eval -- --dry-run                            # run the 40 eval questions
npm test                                             # 14 tests
npm run lint
npm run build
```

## Demo mode (no key needed)

`LLM_PROVIDER=fixture` (the default) uses a local stand-in: hashed word and word-pair vectors for retrieval and an extractive answer that picks the two best-matching sentences. The index is committed (`data/index.fixture.db`), so tests and the demo work offline. It is lexical, so it will miss paraphrases ("My dad passed away" does not match "bereavement"). The page labels these answers "offline demo".

## Evaluation

`eval/questions.jsonl` has 40 questions, each with the expected source document and section:

- 24 answerable (q01–q24)
- 8 unanswerable (q25–q32): off-topic or not in the pages
- 8 tricky (q33–q40): paraphrase with no shared words, false premise, a prompt-injection attempt, and a question where the pages only point to a calculator

Result of `npm run eval -- --dry-run` (offline mode, threshold 0.3), copied from the real output:

| | |
|---|---|
| Should answer | 30 |
| Answered (not refused) | 27 |
| Expected source in top 4 | 22 / 30 |
| Expected source actually cited | 20 / 30 |
| Should refuse | 10 |
| Refused | 7 |

That is a weak result and I am not hiding it. The offline stand-in is lexical, so it is a floor, not a measure of the Gemini setup. The sweep shows the tradeoff: at 0.35 it keeps 27/30 and refuses 9/10; at 0.55 it refuses 10/10 but keeps only 16/30. A few "expected source" misses are arguable (the paid parental leave page and the leave page both cover parental leave). The live numbers are unknown.

## What broke and how I fixed it

- **Test runner.** `vitest` failed to install (dependency conflict). Switched to the built-in `node:test` run through `tsx`.
- **First corpus choice.** I started with the GitLab handbook. Its licence was unclear and a page 404'd, so I switched to the GSA-TTS handbook, which is clearly public domain.
- **Stub chunks.** After stripping links, some chunks were just "See InSite page." and polluted retrieval. Added a 40-character minimum.
- **Refusal threshold too low.** The first fixture threshold (0.2) let an off-topic question through (a World Cup question scored 0.31). Used the eval sweep to set 0.3.
- **`&amp;` in titles.** A title showed as "Logging in &amp; Networks" in citations. Decode it when parsing.
- **Windows file lock.** A running `next start` holds `data/index.fixture.db` open, so `npm run ingest` fails with `EPERM` until the server is stopped.
- **Next.js config.** This Next.js version rejects `runtime`/`dynamic` route exports when `cacheComponents` is on, so the route uses neither. `sqlite-vec` is a native extension, so it is marked as an external package and the index files are included in the route's build output.

## How AI helped

An AI coding assistant wrote most of the first draft of the code, the eval questions and these docs, working from a spec I gave it. I reviewed the files and ran the commands. *(Yazan: rewrite this section in your own words, including what you checked or changed yourself.)*

## Limits

- Not run with a live key. Live answer quality, citation behaviour and the Gemini threshold are untested.
- Not deployed. The `sqlite-vec` native binary for Vercel's Linux runtime is untested.
- The rate limit is in memory, per server instance, and keyed on `x-forwarded-for`. On serverless each instance counts alone, and the header can be forged if there is no proxy in front. It slows abuse; it is not a hard limit.
- No conversation memory: each question stands alone.
- Retrieval is top 4 chunks only. A question that needs facts from many pages may get a partial answer.
- The corpus is a snapshot. It will go stale as the upstream handbook changes.
- English only.

## Licence

Code: MIT (see `LICENSE`). Documents in `data/docs`: public domain / CC0 1.0 (see above).
