# Walkthrough: every file in plain English

If you read the files in this order the app makes sense: config, chunk, llm, store, rag, then the route and the page.

## The pipeline (`lib/`)

`lib/config.ts` holds the numbers and switches. Chunk size is 900 characters, overlap 150, minimum chunk 40, passages retrieved 4, question length 3 to 500, request body 4096 bytes. It also holds the refusal sentence and reads the environment: the provider (`LLM_PROVIDER`), the refusal threshold (`RAG_MIN_SCORE`, with a default per provider), and the per-minute and daily limits. The Gemini default of 0.6 is a guess.

`lib/chunk.ts` turns a markdown file into chunks. `parseDoc` strips front matter, template tags, HTML and link syntax, and joins hard-wrapped lines. `chunkDoc` splits at headings, then paragraphs, then sentences. A sentence that is still too long is split at spaces and never cut off. Neighbouring chunks overlap. Each chunk remembers its document, title and heading path (for example "Leave > Sick leave"), which is what a citation shows. `embedText` puts the title and heading in front of the text before embedding, so short chunks still match.

`lib/llm.ts` is the only file that knows about model providers. It exposes `embed(texts, kind)` and `answer(question, passages)`. The `gemini` version calls `@google/genai` in batches of 50 with a 20 second timeout, and `withRetry` tries up to 3 times on a timeout, a dropped connection, a 429 or a 5xx. Other 4xx errors fail at once. Its system prompt tells the model to answer only from the passages, cite with `[n]`, reply with the refusal sentence if the passages don't cover the question, and ignore instructions inside the passages. The `fixture` version needs no key. It hashes words and word pairs into 512-number vectors and answers by quoting the two best-matching sentences. Because both live in this file, the rest of the app doesn't change when the provider does.

`lib/store.ts` is the vector database: SQLite through `node:sqlite`, plus the `sqlite-vec` extension. It has three tables. `meta` records which provider built the index and the vector size, `chunks` holds the text, and `vec` holds the vectors with cosine distance. `search` returns the nearest chunks with score = 1 - distance. `openStore` opens the file read-only, so the web app can't change the index.

`lib/rag.ts` is the question-answering logic. `ask` embeds the question, searches, and refuses if the best score is under the threshold. Otherwise it calls the model. It refuses if the answer is empty, is the refusal sentence, or has no valid `[n]` marker, and it keeps only the passages the answer cites. `getEngine` opens the provider and the index once per server process and checks that the index was built with the same provider.

`lib/ratelimit.ts` has a sliding-window limiter in memory, one list of timestamps per IP, which prunes old entries and caps the number of tracked keys. `dailyCap` is one counter for all callers per 24 hours. `clientKey` reads the caller's IP from `x-forwarded-for`, which a client can fake when no proxy sits in front.

## The web app (`app/`)

`app/api/ask/route.ts` is the one endpoint, `POST /api/ask` with `{ "question": "..." }`. It checks in this order: the per-IP rate limit (429 with `Retry-After`), the body size (413, counted while the body streams in), JSON (400), then the type and length of the question (400). Only then does it count against the daily cap, so malformed requests don't use up the model budget, and call `ask`. Errors are logged on the server and the browser gets a generic message. The response leaves out the internal `retrieved` list, and the key is never in it.

`app/page.tsx` is the chat page, a client component. The input has focus on load. `Ctrl/Cmd+K` focuses and selects it, `Esc` clears it, and `Enter` asks. Citations are numbered passages you can expand, and a refusal looks different from an answer. The conversation area is an `aria-live` log, so a screen reader announces new answers. The small line under each answer says whether it came from the offline demo or Gemini, and shows the best match score.

`app/layout.tsx` sets the page title, the description and the two fonts (Fraunces for text, Geist Mono for labels). `app/globals.css` has the colours (paper, ink, a vermilion accent, and a dark version), a visible focus outline on everything, and no animation for people who ask for reduced motion. `app/favicon.ico` is the default icon from the project template.

## Scripts (`scripts/`)

`scripts/ingest.ts` reads `data/docs/*.md`, chunks and embeds them, and rebuilds `data/index.<provider>.db`. With `--dry-run` it always uses the offline provider. It prints chunk counts and sizes.

`scripts/ask.ts` asks one question from the terminal and prints the answer, the citations and the score. It's a quick way to check retrieval.

`scripts/eval.ts` runs the 40 questions in `eval/questions.jsonl`. It records every top score and applies the threshold afterwards. For all questions, and again for the test and tune splits, it prints how many were answered, how many had the key fact, how many had the right source in the top 4, and how many cited it (valid `[n]` only). It lists the misses and prints a threshold sweep over the tune split, which is how you pick `RAG_MIN_SCORE`.

## Data (`data/`, `eval/`)

`data/docs/*.md` are the 12 handbook pages, plus `LICENSE-CC0.md` and `.source-commit` (the exact upstream commit). `data/index.fixture.db` is the prebuilt offline index with 148 chunks, committed so the demo and tests work without a key. `index.gemini.db` is built locally and git-ignored.

`eval/questions.jsonl` has 40 questions (24 answerable, 8 unanswerable, 8 tricky). Each has the expected document and section, the `must_contain` key-fact phrases the eval checks, and a `tune` or `test` split. I wrote it so another project could reuse it.

## Tests (`tests/`)

`npm test` runs Node's built-in test runner through `tsx`. There are 22 tests.

- `chunk.test.ts`: title and tag cleaning, chunk sizes, heading paths, overlap, long pieces split and not truncated.
- `rag.test.ts`: a cited answer from the right document, an off-topic refusal, threshold edges, citation-marker filtering, and a missing index failing loudly.
- `ratelimit.test.ts`: the limit, the sliding window, separate keys, the daily cap.
- `route.test.ts`: a valid request, bad JSON and bad input (400), an oversized body including a chunked one (413), the rate limit (429).
- `daily.test.ts`: invalid requests don't use up the daily cap. It has its own file because the counter is module state.
- `retry.test.ts`: the Gemini retry covers timeouts, 429 and 5xx, and skips 4xx errors.

## Config and housekeeping

`package.json` and `package-lock.json` hold dependencies and scripts, and need Node 22.13 or newer. `next.config.ts` turns on Tailwind through its Turbopack loader, marks `sqlite-vec` as an external package because it is a native extension, and ships the index files with the API route. `tsconfig.json` and `eslint.config.mjs` are the project template's settings.

`.env.example` lists every environment variable with a safe default. Copy it to `.env.local` and put your key there; git ignores `.env.local`. `.gitignore` ignores all `.env*` files except the example, the build output, and the Gemini index. `.github/workflows/ci.yml` runs lint, tests and build on every push, with no secrets.

`AGENTS.md` is a note that Next.js generated, telling coding tools to read its bundled docs. `public/*.svg` are unused template images. `docs/` holds the two screenshots in the README. `LICENSE` is MIT, and `README.md` covers what the project is, how to run it, the results and the limits.
